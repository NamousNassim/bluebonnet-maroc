# StartEntreprise public integration API — contract v1 (proposed)

Status: **proposed, not yet implemented by StartEntreprise.** Bluebonnet's adapter is written and
tested against this contract with a stand-in. In production the adapter stays disabled
(`STARTENTREPRISE_INTEGRATION_ENABLED=false`) until StartEntreprise ships these endpoints. This
document is the input specification for that StartEntreprise sprint.

## Principles
- Consumers never reach StartEntreprise databases or internal routes.
- One credential = one organization. The organization is derived from the token, never sent by the client.
- Consumers reference products by the stable **ERP catalogue item id** (`catalogueItemId`, UUID).
- Errors are `application/problem+json` with a stable `code`.
- Every response carries `X-Request-Id`; consumers may send one and it is echoed back.

## Authentication
OAuth2 client credentials against Keycloak:

```
POST {tokenUrl}
grant_type=client_credentials&client_id=…&client_secret=…
→ 200 {"access_token": "…", "expires_in": 300, "token_type": "Bearer"}
```

Scopes: `inventory:availability:read`, `inventory:reservations:write`.

## Availability (batch)

```
GET {baseUrl}/api/public/v1/inventory/availability?catalogueItemIds=<uuid>,<uuid>,…   (max 100)
→ 200 {
  "items": [
    { "catalogueItemId": "…", "status": "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_TRACKED" | "NOT_REGISTERED",
      "quantityAvailable": 12.0 }            // omitted for NOT_TRACKED / NOT_REGISTERED
  ]
}
```
Availability is computed on the organization's default warehouse (`available = onHand − reserved`).

## Reservations
Idempotent on (organization, `source`, `externalReference`, `catalogueItemId`) — the Sprint 3B natural key.

```
POST {baseUrl}/api/public/v1/inventory/reservations
{ "catalogueItemId": "…", "quantity": 2, "externalReference": "BB-CHK-…", "source": "ECOMMERCE", "expiresInSeconds": 900 }
→ 201 created | 200 replayed
{ "id": "…", "status": "ACTIVE", "quantity": 2, "expiresAt": "2026-…Z", "externalReference": "…" }

POST {baseUrl}/api/public/v1/inventory/reservations/{id}/release   → 200 { …, "status": "RELEASED" }  (idempotent)
POST {baseUrl}/api/public/v1/inventory/reservations/{id}/consume   → 200 { …, "status": "CONSUMED" }  (NAPS sprint)
```

A future atomic batch (`POST …/reservations/batch`) is desirable; until it exists consumers must
compensate partial failures by releasing what they reserved (Bluebonnet does).

## Error codes consumers rely on
| HTTP | code | meaning for a storefront |
|---|---|---|
| 409 | `INVENTORY_INSUFFICIENT_STOCK` | not enough available stock |
| 404 | `INVENTORY_ITEM_NOT_REGISTERED` | product not stock-managed |
| 409 | `INVENTORY_STOCK_TRACKING_DISABLED` / `INVENTORY_STOCK_NOT_INITIALIZED` | cannot be reserved |
| 409 | `INVENTORY_IDEMPOTENCY_CONFLICT` | same reference reused with other values |
| 409 | `INVENTORY_RESERVATION_EXPIRED` / `_ALREADY_CONSUMED` / `_ALREADY_RELEASED` | terminal state |
| 401 | — | token expired: refresh once and retry |
| 403 | `SCOPE_REQUIRED` / `ACCESS_DENIED` | configuration error: do not retry |
| 429 | `RATE_LIMITED` | honour `Retry-After` |
| 5xx | — | transient |
