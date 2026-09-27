# Deploying Bluebonnet

Bluebonnet runs on the same VPS as StartEntreprise but as a separate project:

```
/opt/bluebonnet          ← this repository (git clone)
/opt/bluebonnet/secrets  ← bluebonnet.env (chmod 600, git-ignored)
/opt/startentreprise     ← untouched, except that its Caddy imports Bluebonnet's site file
```

Containers: `bluebonnet-frontend`, `bluebonnet-api`, `bluebonnet-postgres`. None publishes a host port.
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
docker ps --filter name=bluebonnet                    # three containers, all healthy, no published ports
curl -sI https://bluebonnetmaroc.com | head -1         # 200
curl -sI https://www.bluebonnetmaroc.com | grep -i location
curl -s https://api.bluebonnetmaroc.com/health         # {"status":"UP","startEntreprise":"DISABLED"}
```

## Opening online ordering (later)

Once StartEntreprise exposes contract v1 and issues a `bluebonnet-storefront` client with scopes
`inventory:availability:read` and `inventory:reservations:write`: set the `STARTENTREPRISE_*` values in
`secrets/bluebonnet.env`, then `STARTENTREPRISE_INTEGRATION_ENABLED=true` and `CHECKOUT_ENABLED=true`, and
recreate `bluebonnet-api`. Map each product's `startEntrepriseCatalogueId` to the real ERP catalogue item first.

## Backups

```bash
mkdir -p /opt/bluebonnet/backups
docker exec bluebonnet-postgres pg_dump -U bluebonnet -Fc bluebonnet > /opt/bluebonnet/backups/bluebonnet-$(date +%F).dump
```
