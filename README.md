# Bluebonnet Maroc — storefront

Independent e-commerce application for Bluebonnet (arts de la table & maison).

| Part | Stack | Path |
| --- | --- | --- |
| Storefront | Next.js 16, React 19, CSS modules | `frontend/` |
| Commerce API | NestJS 11, Prisma 7, PostgreSQL 17 | `backend/` |
| Deployment | Docker Compose + the host's Caddy | `deploy/` |

Bluebonnet owns merchandising (products, categories, FR/AR content, prices), anonymous carts, checkout
sessions and customer-facing orders. **Stock is never stored here**: availability and reservations come
from StartEntreprise through its public API (OAuth2 client credentials), see
[`docs/startentreprise-public-api-contract.md`](docs/startentreprise-public-api-contract.md). Bluebonnet never
touches StartEntreprise databases or code.

## Rules the code enforces

- Prices and totals are computed by the API from its own catalogue (integer centimes, MAD); the browser only sends product ids and quantities.
- Stock is reserved only when a checkout is **confirmed**, never at cart stage; failed lines release what was already reserved.
- Shoppers see coarse availability (in stock / few left / unavailable / confirmed at order), never raw stock.
- Secrets live server-side only (no `NEXT_PUBLIC_*`). The browser talks to `/api/*` on the storefront origin.
- Online ordering stays closed (`CHECKOUT_ENABLED=false`, `STARTENTREPRISE_INTEGRATION_ENABLED=false`) until StartEntreprise ships the public inventory API. Browsing and carts work meanwhile.
- No payment yet: confirmed checkouts become `PENDING` orders; unpaid reservations expire and cancel the order.

## Local development

```bash
docker compose up -d                       # PostgreSQL on 127.0.0.1:55432
cd backend
npm install
export $(grep -v '^#' ../.env.example | xargs)   # or copy the values you need
npx prisma migrate deploy
npm run build && npm run db:seed           # categories (+ demo products with SEED_DEMO_PRODUCTS=true)
npm start                                  # http://localhost:4000

cd ../frontend
npm install
INTERNAL_API_URL=http://localhost:4000 npm run dev   # http://localhost:3000
```

Tests:

```bash
cd backend && npm run typecheck && npm test   # unit + adapter (stand-in over HTTP) + API integration (Testcontainers PostgreSQL)
cd frontend && npm run typecheck && npm test  # Vitest + Testing Library
```

The integration tests need Docker (Testcontainers). The StartEntreprise side is simulated by
`backend/test/support/startentreprise-standin.ts`, which implements contract v1.

## Routes

`/` · `/produits` · `/produits/[slug]` · `/categorie/[slug]` · `/panier` · `/checkout` · `/commande/[id]`
· `/sitemap.xml` · `/robots.txt`. French is canonical; the `bb_locale` cookie switches to Arabic (RTL).

Production deployment: see [`deploy/README.md`](deploy/README.md).
