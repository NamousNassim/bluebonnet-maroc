import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import cookieParser from "cookie-parser";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { StartEntrepriseStandIn } from "./support/startentreprise-standin";

const ORG = "0b8d7c3e-5f1a-4d2b-9c6e-111111111111";
const OTHER_ORG = "0b8d7c3e-5f1a-4d2b-9c6e-222222222222";
const CLIENT_ID = "startentreprise-bluebonnet-management";
const SECRET = "a".repeat(64);
const BASE = "/api/internal/v1/management";
const basic = (id: string, secret: string) => `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
const AUTH = basic(CLIENT_ID, SECRET);

describe("Bluebonnet management API (StartEntreprise → projection)", () => {
  let database: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: PrismaService;
  const standIn = new StartEntrepriseStandIn();
  let categoryId = "";
  let otherCategoryId = "";
  let inactiveCategoryId = "";

  beforeAll(async () => {
    await standIn.start();
    database = await new PostgreSqlContainer("postgres:17-alpine").start();
    const client = new Client({ connectionString: database.getConnectionUri() });
    await client.connect();
    const migrations = join(__dirname, "../prisma/migrations");
    for (const name of readdirSync(migrations).filter((entry) => /^\d/.test(entry)).sort()) {
      await client.query(readFileSync(join(migrations, name, "migration.sql"), "utf8"));
    }
    await client.end();
    Object.assign(process.env, {
      DATABASE_URL: database.getConnectionUri(), CHECKOUT_ENABLED: "true", STARTENTREPRISE_INTEGRATION_ENABLED: "true",
      STARTENTREPRISE_API_URL: standIn.url, STARTENTREPRISE_TOKEN_URL: `${standIn.url}/token`, STARTENTREPRISE_CLIENT_ID: "bluebonnet",
      STARTENTREPRISE_CLIENT_SECRET: standIn.secret, AVAILABILITY_CACHE_SECONDS: "0", LOW_STOCK_DISPLAY_THRESHOLD: "3",
      BLUEBONNET_MANAGEMENT_ENABLED: "true", BLUEBONNET_MANAGEMENT_CLIENT_ID: CLIENT_ID,
      BLUEBONNET_MANAGEMENT_CLIENT_SECRET: SECRET, BLUEBONNET_MANAGEMENT_ORGANIZATION_ID: ORG,
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    categoryId = (await prisma.category.create({ data: { slug: "vaisselle", nameFr: "Vaisselle", sortOrder: 1 } })).id;
    otherCategoryId = (await prisma.category.create({ data: { slug: "verrerie", nameFr: "Verrerie", sortOrder: 2 } })).id;
    inactiveCategoryId = (await prisma.category.create({ data: { slug: "archives", nameFr: "Archives", active: false } })).id;
  });

  afterAll(async () => {
    await app?.close();
    await database?.stop();
    await standIn.stop();
  });

  beforeEach(() => standIn.reset());

  const http = () => request(app.getHttpServer());
  let sequence = 0;
  const listing = () => `7a1c2d3e-4f50-4a6b-8c7d-${String(++sequence).padStart(12, "0")}`;
  const catalogue = () => `9e8d7c6b-5a49-4382-9716-${String(sequence).padStart(12, "0")}`;
  const payload = (overrides: Record<string, unknown> = {}) => ({
    organizationId: ORG, listingVersion: 1, catalogueItemId: catalogue(), slug: `tasse-${sequence}`, sku: `SKU-${sequence}`,
    titleFr: "Tasse Lavande", titleAr: "كوب لافندر", shortDescriptionFr: "Porcelaine peinte.", descriptionFr: "Une tasse.",
    publicPriceCents: 11000, categoryId,
    images: [{ url: "https://startentreprise.ma/api/v1/public/sales-channel-media/a", altFr: "Tasse", position: 0 },
      { url: "https://startentreprise.ma/api/v1/public/sales-channel-media/b", altFr: "Détail", position: 1 }],
    ...overrides,
  });
  const publish = (id: string, body: object, key: string) =>
    http().put(`${BASE}/products/${id}`).set("Authorization", AUTH).set("Idempotency-Key", key).set("X-Request-Id", `req-${key}`).send(body);
  const unpublish = (id: string, version: number, key: string, organizationId = ORG) =>
    http().post(`${BASE}/products/${id}/unpublish`).set("Authorization", AUTH).set("Idempotency-Key", key).send({ organizationId, listingVersion: version });

  describe("authentication", () => {
    it("refuses anonymous, wrong-client and wrong-secret callers, and never uses cookies", async () => {
      expect((await http().get(`${BASE}/categories`).expect(401)).body.code).toBe("UNAUTHORIZED");
      expect((await http().get(`${BASE}/categories`).set("Authorization", basic("bluebonnet-storefront", SECRET)).expect(403)).body.code).toBe("FORBIDDEN");
      expect((await http().get(`${BASE}/categories`).set("Authorization", basic(CLIENT_ID, "b".repeat(64))).expect(401)).body.code).toBe("UNAUTHORIZED");
      expect((await http().get(`${BASE}/categories`).set("Authorization", `Bearer ${SECRET}`).expect(401)).body.code).toBe("UNAUTHORIZED");
      await http().get(`${BASE}/categories`).set("Cookie", "bb_cart=x").expect(401);
      expect((await http().get(`${BASE}/connection`).set("Authorization", AUTH).expect(200)).body).toMatchObject({ organizationId: ORG, status: "CONNECTED" });
    });

    it("refuses an organization that is not bound to this storefront", async () => {
      const id = listing();
      expect((await publish(id, payload({ organizationId: OTHER_ORG }), `k-${id}`).expect(403)).body.code).toBe("FORBIDDEN");
      expect((await http().get(`${BASE}/products?organizationId=${OTHER_ORG}`).set("Authorization", AUTH).expect(403)).body.code).toBe("FORBIDDEN");
    });

    it("is not exposed through the public storefront API", async () => {
      await http().get(`/v1/internal/v1/management/categories`).set("Authorization", AUTH).expect(404);
    });
  });

  describe("categories", () => {
    it("lists every category, including inactive ones, for the merchant to choose from", async () => {
      const body = (await http().get(`${BASE}/categories`).set("Authorization", AUTH).expect(200)).body;
      expect(body.map((category: { slug: string }) => category.slug)).toEqual(["archives", "vaisselle", "verrerie"]);
      expect(body.find((category: { slug: string }) => category.slug === "archives").active).toBe(false);
    });

    it("creates, renames, deactivates and reactivates categories with stable errors", async () => {
      const created = (await http().post(`${BASE}/categories`).set("Authorization", AUTH)
        .send({ slug: "linge-de-table", nameFr: "Linge de table", nameAr: "مفروشات", sortOrder: 3 }).expect(201)).body;
      expect(created).toMatchObject({ slug: "linge-de-table", active: true });
      expect((await http().post(`${BASE}/categories`).set("Authorization", AUTH).send({ slug: "linge-de-table", nameFr: "Doublon" }).expect(409)).body.code).toBe("INVALID_CATEGORY");
      expect((await http().post(`${BASE}/categories`).set("Authorization", AUTH).send({ slug: "Mauvais Slug", nameFr: "X" }).expect(422)).body.code).toBe("INVALID_CATEGORY");
      await http().put(`${BASE}/categories/${created.id}`).set("Authorization", AUTH).send({ nameFr: "Linge" }).expect(200);
      expect((await http().put(`${BASE}/categories/${created.id}`).set("Authorization", AUTH).send({ active: false }).expect(200)).body.active).toBe(false);
      expect((await http().get("/v1/categories").expect(200)).body.map((category: { slug: string }) => category.slug)).not.toContain("linge-de-table");
      await http().put(`${BASE}/categories/${created.id}`).set("Authorization", AUTH).send({ active: true }).expect(200);
      expect((await http().put(`${BASE}/categories/00000000-0000-4000-8000-000000000000`).set("Authorization", AUTH).send({ nameFr: "X" }).expect(404)).body.code).toBe("CATEGORY_NOT_FOUND");
      expect((await http().put(`${BASE}/categories/not-a-uuid`).set("Authorization", AUTH).send({ nameFr: "X" }).expect(404)).body.code).toBe("CATEGORY_NOT_FOUND");
    });
  });

  describe("listing projection", () => {
    it("creates a local product keyed by listing id, shown on the storefront with live stock", async () => {
      const id = listing();
      const body = payload();
      standIn.setStock(body.catalogueItemId, 2);
      const created = (await publish(id, body, `k1-${id}`).expect(200)).body;
      expect(created).toMatchObject({ salesChannelListingId: id, startEntrepriseCatalogueId: body.catalogueItemId, listingVersion: 1,
        published: true, active: true, priceCents: 11000, categoryId });
      const row = await prisma.product.findUniqueOrThrow({ where: { salesChannelListingId: id }, include: { images: { orderBy: { position: "asc" } } } });
      expect(row).toMatchObject({ nameFr: "Tasse Lavande", nameAr: "كوب لافندر", sku: body.sku, sourceOrganizationId: ORG, priceCents: 11000 });
      expect(row.images.map((image) => image.url)).toEqual(body.images.map((image) => image.url));
      // No stock is stored with the projection: the storefront asks StartEntreprise at read time.
      expect(Object.keys(row).filter((key) => /quantity|stock|onHand|reserved/i.test(key))).toEqual([]);
      const detail = (await http().get(`/v1/products/${body.slug}`).expect(200)).body;
      expect(detail).toMatchObject({ nameFr: "Tasse Lavande", priceCents: 11000, availability: { state: "LOW_STOCK", remaining: 2 } });
      expect(standIn.calls.some((call) => call.path.includes(body.catalogueItemId))).toBe(true);
    });

    it("applies newer versions to the same row, replays duplicates and refuses stale versions", async () => {
      const id = listing();
      const v1 = payload();
      const created = (await publish(id, v1, `v1-${id}`).expect(200)).body;
      // The same job retried (same Idempotency-Key) returns the recorded result without writing again.
      expect((await publish(id, v1, `v1-${id}`).expect(200)).body).toEqual(created);
      // The same version resent under another key is a harmless no-op...
      expect((await publish(id, v1, `v1-again-${id}`).expect(200)).body.productId).toBe(created.productId);
      // ...but reusing a key for different content, or changing a version's content, is refused.
      expect((await publish(id, { ...v1, titleFr: "Autre" }, `v1-${id}`).expect(409)).body.code).toBe("IDEMPOTENCY_CONFLICT");
      expect((await publish(id, { ...v1, titleFr: "Autre" }, `v1-other-${id}`).expect(409)).body.code).toBe("IDEMPOTENCY_CONFLICT");

      const v2 = { ...v1, listingVersion: 2, titleFr: "Tasse Lavande v2", publicPriceCents: 12500, categoryId: otherCategoryId };
      const updated = (await publish(id, v2, `v2-${id}`).expect(200)).body;
      expect(updated).toMatchObject({ productId: created.productId, listingVersion: 2, priceCents: 12500, categoryId: otherCategoryId });

      // A delayed v1 retry arriving after v2 never overwrites it.
      const stale = (await publish(id, v1, `v1-late-${id}`).expect(409)).body;
      expect(stale).toMatchObject({ code: "STALE_LISTING_VERSION", fields: { currentVersion: "2" } });
      expect(await prisma.product.findUniqueOrThrow({ where: { salesChannelListingId: id } })).toMatchObject({ nameFr: "Tasse Lavande v2", listingVersion: 2 });
      expect((await http().get(`/v1/products/${v1.slug}`).expect(200)).body).toMatchObject({ nameFr: "Tasse Lavande v2", priceCents: 12500 });
    });

    it("reconciles images: updates in place, adds, removes, and keeps the order deterministic", async () => {
      const id = listing();
      const v1 = payload();
      await publish(id, v1, `i1-${id}`).expect(200);
      const before = await prisma.productImage.findMany({ where: { product: { salesChannelListingId: id } }, orderBy: { position: "asc" } });
      const v2 = { ...v1, listingVersion: 2, images: [
        { url: "https://startentreprise.ma/api/v1/public/sales-channel-media/c", altFr: "Nouvelle", position: 2 },
        { url: v1.images[0].url, altFr: "Tasse (face)", altAr: "كوب", position: 0 },
      ] };
      const result = (await publish(id, v2, `i2-${id}`).expect(200)).body;
      expect(result.images.map((image: { position: number; altFr: string }) => [image.position, image.altFr])).toEqual([[0, "Tasse (face)"], [2, "Nouvelle"]]);
      const after = await prisma.productImage.findMany({ where: { product: { salesChannelListingId: id } }, orderBy: { position: "asc" } });
      expect(after[0].id).toBe(before[0].id);
      expect(after.map((image) => image.position)).toEqual([0, 2]);
      await publish(id, { ...v2, listingVersion: 3, images: [] }, `i3-${id}`).expect(200);
      expect(await prisma.productImage.count({ where: { product: { salesChannelListingId: id } } })).toBe(0);
    });

    it("rejects invalid payloads with stable codes and without touching the row", async () => {
      const id = listing();
      expect((await publish(id, payload({ publicPriceCents: 0 }), `bad-price-${id}`).expect(422)).body.code).toBe("INVALID_PRICE");
      expect((await publish(id, payload({ images: [{ url: "javascript:alert(1)", altFr: "x", position: 0 }] }), `bad-img-${id}`).expect(422)).body.code).toBe("INVALID_IMAGE");
      expect((await publish(id, payload({ images: [{ url: "http://insecure.example/a.jpg", altFr: "x", position: 0 }] }), `bad-img2-${id}`).expect(422)).body.code).toBe("INVALID_IMAGE");
      expect((await publish(id, payload({ categoryId: inactiveCategoryId }), `bad-cat-${id}`).expect(422)).body.code).toBe("INVALID_CATEGORY");
      expect((await publish(id, payload({ categoryId: "00000000-0000-4000-8000-000000000000" }), `bad-cat2-${id}`).expect(422)).body.code).toBe("INVALID_CATEGORY");
      expect((await publish(id, payload({ titleFr: "" }), `bad-title-${id}`).expect(422)).body.code).toBe("INVALID_PRODUCT");
      expect((await publish("not-a-uuid", payload(), `bad-id-${id}`).expect(400)).body.code).toBe("INVALID_LISTING_ID");
      expect((await http().put(`${BASE}/products/${id}`).set("Authorization", AUTH).send(payload()).expect(400)).body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
      expect(await prisma.product.count({ where: { salesChannelListingId: id } })).toBe(0);
    });

    it("refuses a slug or catalogue item already used by another product", async () => {
      const first = listing();
      const body = payload();
      await publish(first, body, `dup1-${first}`).expect(200);
      const second = listing();
      expect((await publish(second, payload({ slug: body.slug }), `dup2-${second}`).expect(422)).body.code).toBe("INVALID_PRODUCT");
      expect((await publish(second, payload({ catalogueItemId: body.catalogueItemId }), `dup3-${second}`).expect(422)).body.code).toBe("INVALID_PRODUCT");
    });

    it("serializes concurrent retries of the same job", async () => {
      const id = listing();
      const body = payload();
      const results = await Promise.all([1, 2, 3, 4].map(() => publish(id, body, `race-${id}`)));
      expect(results.map((result) => result.status)).toEqual([200, 200, 200, 200]);
      expect(new Set(results.map((result) => result.body.productId)).size).toBe(1);
      expect(await prisma.product.count({ where: { salesChannelListingId: id } })).toBe(1);
    });
  });

  describe("unpublish and republish", () => {
    it("hides the product publicly but keeps the row, and republishing reuses it", async () => {
      const id = listing();
      const body = payload();
      const created = (await publish(id, body, `p1-${id}`).expect(200)).body;
      const hidden = (await unpublish(id, 2, `u2-${id}`).expect(200)).body;
      expect(hidden).toMatchObject({ productId: created.productId, published: false, active: false, listingVersion: 2 });
      expect((await unpublish(id, 2, `u2-${id}`).expect(200)).body).toEqual(hidden);
      await http().get(`/v1/products/${body.slug}`).expect(404);
      expect((await http().get("/v1/products?size=48").expect(200)).body.items.map((item: { id: string }) => item.id)).not.toContain(created.productId);
      expect(await prisma.product.count({ where: { salesChannelListingId: id } })).toBe(1);

      // A delayed publish of v1 must not resurrect the unpublished product.
      expect((await publish(id, body, `p1-late-${id}`).expect(409)).body.code).toBe("STALE_LISTING_VERSION");
      await http().get(`/v1/products/${body.slug}`).expect(404);

      const again = (await publish(id, { ...body, listingVersion: 3 }, `p3-${id}`).expect(200)).body;
      expect(again).toMatchObject({ productId: created.productId, published: true, listingVersion: 3 });
      await http().get(`/v1/products/${body.slug}`).expect(200);
      expect((await unpublish(id, 2, `u2-late-${id}`).expect(409)).body.code).toBe("STALE_LISTING_VERSION");
    });

    it("reports a listing that was never projected", async () => {
      expect((await unpublish(listing(), 1, "u-missing").expect(404)).body.code).toBe("LISTING_NOT_FOUND");
    });

    it("exposes listing state for reconciliation", async () => {
      const id = listing();
      await publish(id, payload(), `r1-${id}`).expect(200);
      const one = (await http().get(`${BASE}/products/${id}?organizationId=${ORG}`).set("Authorization", AUTH).expect(200)).body;
      expect(one).toMatchObject({ salesChannelListingId: id, listingVersion: 1, published: true });
      const all = (await http().get(`${BASE}/products?organizationId=${ORG}`).set("Authorization", AUTH).expect(200)).body.items;
      expect(all.some((item: { salesChannelListingId: string }) => item.salesChannelListingId === id)).toBe(true);
      expect((await http().get(`${BASE}/products/${listing()}?organizationId=${ORG}`).set("Authorization", AUTH).expect(404)).body.code).toBe("LISTING_NOT_FOUND");
    });
  });

  it("leaves legacy manual products untouched and visible", async () => {
    const legacy = await prisma.product.create({ data: { slug: "tasse", nameFr: "Tasse", startEntrepriseCatalogueId: "11111111-2222-4333-8444-555555555555",
      categoryId, priceCents: 9000, published: true, publishedAt: new Date() } });
    expect(legacy).toMatchObject({ salesChannelListingId: null, listingVersion: 0 });
    await http().get("/v1/products/tasse").expect(200);
    const all = (await http().get(`${BASE}/products?organizationId=${ORG}`).set("Authorization", AUTH).expect(200)).body.items;
    expect(all.map((item: { productId: string }) => item.productId)).not.toContain(legacy.id);
  });
});
