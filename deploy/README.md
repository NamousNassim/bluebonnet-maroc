# Deploying Bluebonnet

Bluebonnet runs on the same VPS as StartEntreprise but as a separate project:

```
/opt/bluebonnet          ← this repository (git clone)
/opt/bluebonnet/secrets  ← bluebonnet.env (chmod 600, git-ignored)
/opt/startentreprise     ← untouched, except that its Caddy imports Bluebonnet's site file
```

Containers: `bluebonnet-frontend`, `bluebonnet-api`, `bluebonnet-postgres`, and `bluebonnet-backup`.
None publishes a host port.
The existing StartEntreprise Caddy (the only thing on 80/443) reaches the frontend and API over the
external Docker network `shared-edge`. PostgreSQL is only on Bluebonnet's `internal` network.

| Host | Routed to |
| --- | --- |
| `bluebonnetmaroc.com` | `bluebonnet-frontend:3000` (the storefront also proxies `/api/*` to the API internally) |
| `www.bluebonnetmaroc.com` | 301 → `https://bluebonnetmaroc.com` |
| `api.bluebonnetmaroc.com` | `bluebonnet-api:4000` |

## DNS

A (and AAAA if used) records for `bluebonnetmaroc.com`, `www.bluebonnetmaroc.com` and
`api.bluebonnetmaroc.com` pointing at the VPS. Caddy issues the certificates on first request.

## First installation

```bash
# 1. Shared network (once per host)
docker network create shared-edge

# 2. Code and secrets
sudo mkdir -p /opt/bluebonnet && sudo chown "$USER" /opt/bluebonnet
git clone <bluebonnet repository> /opt/bluebonnet
cd /opt/bluebonnet
mkdir -p secrets && cp .env.prod.example secrets/bluebonnet.env && chmod 600 secrets/bluebonnet.env
sudo install -d -m 700 /opt/bluebonnet/backups
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" secrets/bluebonnet.env
# leave CHECKOUT_ENABLED=false and STARTENTREPRISE_INTEGRATION_ENABLED=false for now

# 3. Start (migrations run automatically when the API starts)
docker compose -f deploy/compose.prod.yml --env-file secrets/bluebonnet.env up -d --build
docker exec bluebonnet-api npm run db:seed          # the five categories; idempotent

# 4. Let StartEntreprise's Caddy serve the Bluebonnet sites
#    (requires the StartEntreprise version whose Caddy imports /etc/caddy/sites/*.caddy and joins shared-edge)
echo 'CADDY_SITES_DIR=/opt/bluebonnet/deploy/caddy' >> /opt/startentreprise/secrets/docker.env
cd /opt/startentreprise/docker
docker compose -f compose.prod.yml --env-file /opt/startentreprise/secrets/docker.env up -d caddy
docker compose -f compose.prod.yml --env-file /opt/startentreprise/secrets/docker.env exec caddy \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

## Updates

```bash
cd /opt/bluebonnet && git pull
docker compose -f deploy/compose.prod.yml --env-file secrets/bluebonnet.env up -d --build
# after changing deploy/caddy/bluebonnet.caddy:
cd /opt/startentreprise/docker && docker compose -f compose.prod.yml --env-file /opt/startentreprise/secrets/docker.env \
  exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

## Checks

```bash
docker ps --filter name=bluebonnet                    # application + backup containers, no published ports
curl -sI https://bluebonnetmaroc.com | head -1         # 200
curl -sI https://www.bluebonnetmaroc.com | grep -i location
curl -s https://api.bluebonnetmaroc.com/health         # {"status":"UP","startEntreprise":"DISABLED"}
```

## Real StartEntreprise mapping and rollout

Create `bluebonnet-storefront` in StartEntreprise under **Paramètres → Intégrations API** with only
`inventory:availability:read` and `inventory:reservations:write`. Put the one-time client id and secret
in `secrets/bluebonnet.env`; never use `NEXT_PUBLIC_*`. Keep both feature flags false initially.

The mapping importer accepts JSON and defaults to dry-run:

```json
[
  { "slug": "assiette-gres-artisanal", "startEntrepriseCatalogueId": "REAL-ERP-UUID" }
]
```

Before applying mappings, take and verify a named backup:

```bash
docker exec bluebonnet-backup sh -ec \
  'target=/backups/pre-mapping-$(date -u +%Y%m%dT%H%M%SZ).dump; pg_dump -Fc --file="$target"; test -s "$target"; ls -lh "$target"'
docker cp product-mappings.json bluebonnet-api:/tmp/product-mappings.json
docker exec bluebonnet-api npm run products:mappings -- --file /tmp/product-mappings.json
# Inspect every from/to value. Applying an existing mapping requires both explicit switches:
docker exec bluebonnet-api npm run products:mappings -- \
  --file /tmp/product-mappings.json --apply --allow-remap
```

Never map the Sprint 1 demo UUID range. Find and unpublish any remaining placeholder products before
rollout:

```bash
docker exec bluebonnet-postgres psql -U bluebonnet -d bluebonnet -c \
  "select slug,startentreprise_catalogue_id,published from products where startentreprise_catalogue_id::text like '8b2f3d7e-0a1c-4c55-9a51-00000000000%';"
# If a demo product is not being remapped, unpublish it explicitly after the verified backup:
docker exec bluebonnet-postgres psql -U bluebonnet -d bluebonnet -c \
  "update products set published=false, active=false where startentreprise_catalogue_id::text like '8b2f3d7e-0a1c-4c55-9a51-00000000000%';"
```

Run preflight without changing the service's persisted feature flag:

```bash
docker exec -e STARTENTREPRISE_INTEGRATION_ENABLED=true bluebonnet-api \
  npm run products:mappings -- --preflight
```

Then run the controlled one-product token → availability → reserve/replay → release smoke test. Use
one real catalogue UUID with a known small quantity:

```bash
docker exec -e STARTENTREPRISE_INTEGRATION_ENABLED=true bluebonnet-api \
  npm run integration:smoke -- REAL-ERP-UUID 1
```

Confirm Inventory availability decreases during reservation and returns after release, and inspect
Bluebonnet/StartEntreprise logs for matching request ids without tokens or secrets. Also verify an
invalid secret is rejected, missing scope returns 403, unknown item/insufficient stock/idempotency
conflict return their documented codes, and 429 supplies `Retry-After` where practical.

Only after preflight and smoke succeed:

1. Set `STARTENTREPRISE_INTEGRATION_ENABLED=true`, keeping `CHECKOUT_ENABLED=false`.
2. Recreate `bluebonnet-api` and validate FR/AR storefront availability and cart behavior.
3. Validate checkout reservation, compensation, and expiry in a controlled environment.
4. Keep `CHECKOUT_ENABLED=false` if paid ordering must wait for NAPS; enabling stock integration does
   not authorize enabling checkout.

## Product publishing from StartEntreprise (Canaux de vente)

Products are no longer created in this database by hand. The merchant manages them in StartEntreprise →
**Canaux de vente → Bluebonnet** (create a listing from a catalogue product, then explicitly *Publier*). StartEntreprise
then calls this API's private management namespace, `/api/internal/v1/management/*`, which:

- is machine-to-machine only (HTTP Basic, client `startentreprise-bluebonnet-management` + a dedicated secret; never the
  storefront's stock client, a user session or cookies);
- is reached only over the private Docker network `sales-channels`, shared by `bluebonnet-api` and StartEntreprise's `api`
  (nothing else joins it; PostgreSQL never does);
- is refused publicly by Caddy on both hosts (`/api/internal/*`, `/api/api/*`), and the storefront proxy only forwards `/api/v1/*`.

Each product row is keyed by `sales_channel_listing_id` and only ever moves forward in `listing_version`: a delayed retry of an
older version gets `409 STALE_LISTING_VERSION` and changes nothing. Unpublishing sets `published=false, active=false` and keeps
the row; republishing reuses it. Stock is never stored here — availability is still read live from StartEntreprise.

### Enabling it

```bash
docker network create sales-channels                  # once per host
SECRET=$(openssl rand -hex 32)
# Bluebonnet side (/opt/bluebonnet-maroc-secrets/bluebonnet.env):
#   BLUEBONNET_MANAGEMENT_ENABLED=true
#   BLUEBONNET_MANAGEMENT_CLIENT_SECRET=$SECRET
#   BLUEBONNET_MANAGEMENT_ORGANIZATION_ID=<UUID of the StartEntreprise organization that owns the shop>
#   IMAGE_HOST=startentreprise.ma                       # listing images are served by StartEntreprise
# StartEntreprise side (/opt/startentreprise/secrets/docker.env):
#   BLUEBONNET_MANAGEMENT_API_URL=http://bluebonnet-api:4000
#   BLUEBONNET_MANAGEMENT_CLIENT_SECRET=$SECRET
cd /opt/bluebonnet-maroc && bb up -d --build bluebonnet-api bluebonnet-frontend
cd /opt/startentreprise/app && dc up -d api caddy
# Private reachability check (from StartEntreprise's API container), and the public refusal:
dc exec api bash -c 'exec 3<>/dev/tcp/bluebonnet-api/4000 && echo reachable'                                                  # reachable
curl -s -o /dev/null -w "%{http_code}\n" https://api.bluebonnetmaroc.com/api/internal/v1/management/connection               # 404
curl -s -o /dev/null -w "%{http_code}\n" https://bluebonnetmaroc.com/api/api/internal/v1/management/connection               # 404
```

The organization UUID is shown in StartEntreprise's URL (`/dashboard/organizations/<uuid>/…`). Only that organization can
connect the channel; any other gets `CHANNEL_BOUND_TO_ANOTHER_ORGANIZATION`.

### The temporary `tasse` product

A product inserted manually before this sprint has no `sales_channel_listing_id` (a "legacy" row). It is left untouched: it stays
visible if it is published, and nothing deletes or rewrites it automatically. Identify it with:

```bash
docker exec bluebonnet-postgres psql -U bluebonnet -d bluebonnet -c \
  "select id, slug, name_fr, startentreprise_catalogue_id, published from products where sales_channel_listing_id is null;"
```

To replace it with a managed listing (recommended):

1. Hide the manual row (it keeps its id and history):
   `update products set published = false, active = false where slug = 'tasse' and sales_channel_listing_id is null;`
2. If StartEntreprise will publish the **same catalogue item** or reuse the slug `tasse`, free those unique values on the legacy
   row first, otherwise the publication is refused with `INVALID_PRODUCT` (visible as *Action requise*):
   `update products set slug = 'tasse-legacy', startentreprise_catalogue_id = gen_random_uuid() where slug = 'tasse' and sales_channel_listing_id is null;`
3. In StartEntreprise → Canaux de vente → Bluebonnet: *Nouvelle annonce*, choose the product, set price/category/images, *Publier*.

To simply remove it from the shop, step 1 is enough. Carts that contained it show it as unavailable; past orders keep their snapshot.

## Backups and restore

`bluebonnet-backup` creates a compressed backup immediately and then daily by default. Backups are
mounted at `/opt/bluebonnet/backups`, outside the Git working tree, and retained for 14 days. Verify it:

```bash
docker logs --tail 20 bluebonnet-backup
find /opt/bluebonnet/backups -maxdepth 1 -type f -name 'bluebonnet-*.dump' -size +0 -ls
```

Restore requires a maintenance window and stops the API first:

```bash
docker compose -f deploy/compose.prod.yml --env-file secrets/bluebonnet.env stop bluebonnet-api
docker exec -i bluebonnet-postgres pg_restore -U bluebonnet -d bluebonnet --clean --if-exists < /opt/bluebonnet/backups/FILE.dump
docker compose -f deploy/compose.prod.yml --env-file secrets/bluebonnet.env start bluebonnet-api
```

Test restore procedure on a non-production database before relying on it. Database credential rotation
requires changing `POSTGRES_PASSWORD`, rotating the PostgreSQL role password, and recreating dependent
containers in one maintenance window; do not merely edit the env file against an existing data volume.

## Host housekeeping

```bash
docker network inspect shared-edge >/dev/null || docker network create shared-edge
find /opt/startentreprise /opt/bluebonnet -path '*/.git' -prune -o -type f -name '*.dump' -print
```

Move any reported dump into its project's protected backup directory before deployment. Do not keep
database dumps in either Git working tree.
