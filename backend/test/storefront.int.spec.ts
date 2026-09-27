import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import cookieParser from "cookie-parser";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { APP_CONFIG, AppConfig } from "../src/config/app-config";
import { PrismaService } from "../src/prisma/prisma.service";
import { StartEntrepriseStandIn } from "./support/startentreprise-standin";

const WEB = { "X-Bluebonnet-Client": "web" };
const customer = { firstName: "Salma", lastName: "Bennani", email: "Salma@Example.ma", phone: "06 12 34 56 78",
  addressLine: "12 rue des Orangers, Agdal", city: "Rabat", postalCode: "10090", notes: "Sonner deux fois" };

describe("Bluebonnet storefront API (PostgreSQL + StartEntreprise stand-in)", () => {
  let database: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: PrismaService;
  const standIn = new StartEntrepriseStandIn();
  const ids = { vaisselle: "", verrerie: "", hidden: "", plate: "", bowl: "", glass: "", draft: "", archivedCategoryProduct: "" };
  const catalogue = { plate: "aaaaaaaa-0000-4000-8000-000000000001", bowl: "aaaaaaaa-0000-4000-8000-000000000002",
    glass: "aaaaaaaa-0000-4000-8000-000000000003", draft: "aaaaaaaa-0000-4000-8000-000000000004", hidden: "aaaaaaaa-0000-4000-8000-000000000005" };

  beforeAll(async () => {
    await standIn.start();
    database = await new PostgreSqlContainer("postgres:17-alpine").start();
    const migration = readFileSync(join(__dirname, "../prisma/migrations/20260927000000_init/migration.sql"), "utf8");
    const client = new Client({ connectionString: database.getConnectionUri() });
    await client.connect();
    await client.query(migration);
    await client.end();
    Object.assign(process.env, {
      DATABASE_URL: database.getConnectionUri(), CHECKOUT_ENABLED: "true", STARTENTREPRISE_INTEGRATION_ENABLED: "true",
      STARTENTREPRISE_API_URL: standIn.url, STARTENTREPRISE_TOKEN_URL: `${standIn.url}/token`, STARTENTREPRISE_CLIENT_ID: "bluebonnet",
      STARTENTREPRISE_CLIENT_SECRET: standIn.secret, AVAILABILITY_CACHE_SECONDS: "0", SHIPPING_FLAT_CENTS: "3000",
      FREE_SHIPPING_THRESHOLD_CENTS: "80000", LOW_STOCK_DISPLAY_THRESHOLD: "3",
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    await seed();
  });

  afterAll(async () => {
    await app?.close();
    await database?.stop();
    await standIn.stop();
  });

  beforeEach(() => {
    standIn.reset();
    standIn.setStock(catalogue.plate, 10);
    standIn.setStock(catalogue.bowl, 2);
    standIn.setStock(catalogue.glass, 5);
  });

  async function seed() {
    const vaisselle = await prisma.category.create({ data: { slug: "vaisselle", nameFr: "Vaisselle", nameAr: "الأواني", sortOrder: 1 } });
    const verrerie = await prisma.category.create({ data: { slug: "verrerie", nameFr: "Verrerie", sortOrder: 2 } });
    const hidden = await prisma.category.create({ data: { slug: "archives", nameFr: "Archives", active: false, sortOrder: 3 } });
    Object.assign(ids, { vaisselle: vaisselle.id, verrerie: verrerie.id, hidden: hidden.id });
    const make = (slug: string, name: string, catalogueId: string, categoryId: string, price: number, extra: object = {}) => prisma.product.create({ data: {
      slug, nameFr: name, startEntrepriseCatalogueId: catalogueId, categoryId, priceCents: price, sku: slug.toUpperCase(),
      published: true, publishedAt: new Date(), images: { create: [{ url: `/images/${slug}.svg`, altFr: name, position: 0 }] }, ...extra,
    } });
    ids.plate = (await make("assiette", "Assiette en grès", catalogue.plate, vaisselle.id, 24500, { featured: true, publishedAt: new Date(Date.now() - 1000) })).id;
    ids.bowl = (await make("bol", "Bol cobalt", catalogue.bowl, vaisselle.id, 14500)).id;
    ids.glass = (await make("verre", "Verre ciselé", catalogue.glass, verrerie.id, 9500, { publishedAt: new Date(Date.now() - 2000) })).id;
    ids.draft = (await make("brouillon", "Produit brouillon", catalogue.draft, vaisselle.id, 5000, { published: false, publishedAt: null })).id;
    ids.archivedCategoryProduct = (await make("cache", "Produit caché", catalogue.hidden, hidden.id, 5000)).id;
  }

  const agent = () => request.agent(app.getHttpServer());

  describe("catalogue", () => {
    it("lists only active categories in order", async () => {
      const response = await request(app.getHttpServer()).get("/v1/categories").expect(200);
      expect(response.body.map((category: { slug: string }) => category.slug)).toEqual(["vaisselle", "verrerie"]);
      await request(app.getHttpServer()).get("/v1/categories/archives").expect(404);
    });

    it("pages, filters, searches and sorts published products only, with batched availability", async () => {
      const all = await request(app.getHttpServer()).get("/v1/products").expect(200);
      expect(all.body.items.map((item: { slug: string }) => item.slug)).toEqual(["bol", "assiette", "verre"]);
      expect(all.body.total).toBe(3);
      expect(standIn.calls.filter((call) => call.path.includes("/availability"))).toHaveLength(1);

      const cheap = await request(app.getHttpServer()).get("/v1/products?sort=price_asc&size=2&page=1").expect(200);
      expect(cheap.body.items.map((item: { slug: string }) => item.slug)).toEqual(["verre", "bol"]);
      expect(cheap.body.totalPages).toBe(2);
      const category = await request(app.getHttpServer()).get("/v1/products?category=verrerie").expect(200);
      expect(category.body.items.map((item: { slug: string }) => item.slug)).toEqual(["verre"]);
      const search = await request(app.getHttpServer()).get("/v1/products?search=COBALT").expect(200);
      expect(search.body.items.map((item: { slug: string }) => item.slug)).toEqual(["bol"]);
      await request(app.getHttpServer()).get("/v1/products?size=500").expect(400);
    });

    it("hides unpublished products and products of inactive categories", async () => {
      await request(app.getHttpServer()).get("/v1/products/brouillon").expect(404);
      await request(app.getHttpServer()).get("/v1/products/cache").expect(404);
      const sitemap = await request(app.getHttpServer()).get("/v1/sitemap").expect(200);
      expect(sitemap.body.products.map((item: { slug: string }) => item.slug).sort()).toEqual(["assiette", "bol", "verre"]);
    });

    it("shows coarse availability, never the raw stock", async () => {
      const plate = await request(app.getHttpServer()).get("/v1/products/assiette").expect(200);
      expect(plate.body.availability).toEqual({ state: "IN_STOCK" });
      expect(JSON.stringify(plate.body)).not.toContain("quantityAvailable");
      expect((await request(app.getHttpServer()).get("/v1/products/bol").expect(200)).body.availability).toEqual({ state: "LOW_STOCK", remaining: 2 });
      standIn.setStock(catalogue.bowl, 0);
      expect((await request(app.getHttpServer()).get("/v1/products/bol").expect(200)).body.availability).toEqual({ state: "OUT_OF_STOCK" });
      standIn.failures.push({ match: () => true, status: 503 }, { match: () => true, status: 503 });
      expect((await request(app.getHttpServer()).get("/v1/products/bol").expect(200)).body.availability).toEqual({ state: "UNKNOWN" });
    });
  });

  describe("cart", () => {
    it("works anonymously through an httpOnly cookie and prices every line on the server", async () => {
      const browser = agent();
      const added = await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 2, priceCents: 1 }).expect(201);
      expect(added.headers["set-cookie"][0]).toMatch(/^bb_cart=[\w-]{43}; Max-Age=2592000; Path=\/; .*HttpOnly; SameSite=Lax$/);
      expect(added.body.items[0]).toMatchObject({ productId: ids.plate, unitPriceCents: 24500, quantity: 2, lineTotalCents: 49000 });
      expect(added.body.totals).toMatchObject({ subtotalCents: 49000, shippingCents: 3000, totalCents: 52000 });

      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 1 }).expect(201);
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.glass, quantity: 1 }).expect(201);
      const updated = await browser.patch(`/v1/cart/items/${ids.plate}`).set(WEB).send({ quantity: 4 }).expect(200);
      expect(updated.body.itemCount).toBe(5);
      expect(updated.body.totals).toMatchObject({ subtotalCents: 107500, shippingCents: 0, totalCents: 107500 });
      const removed = await browser.delete(`/v1/cart/items/${ids.glass}`).set(WEB).expect(200);
      expect(removed.body.items).toHaveLength(1);
      await browser.delete("/v1/cart").set(WEB).expect(200);
      expect((await browser.get("/v1/cart").expect(200)).body).toMatchObject({ items: [], itemCount: 0, totals: { totalCents: 0 } });
      expect(standIn.calls.filter((call) => call.method === "POST")).toHaveLength(0);
    });

    it("rejects unpublished products, invalid quantities and cookie-less CSRF attempts", async () => {
      const browser = agent();
      expect((await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.draft, quantity: 1 }).expect(404)).body.code).toBe("PRODUCT_UNAVAILABLE");
      expect((await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 0 }).expect(400)).body.code).toBe("VALIDATION_FAILED");
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 99 }).expect(201);
      expect((await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 1 }).expect(400)).body.code).toBe("QUANTITY_LIMIT");
      expect((await browser.post("/v1/cart/items").send({ productId: ids.plate, quantity: 1 }).expect(400)).body.code).toBe("CLIENT_HEADER_REQUIRED");
    });

    it("flags a product unpublished after it was added and excludes it from totals", async () => {
      const browser = agent();
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.bowl, quantity: 1 }).expect(201);
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.glass, quantity: 1 }).expect(201);
      await prisma.product.update({ where: { id: ids.bowl }, data: { published: false } });
      try {
        const cart = (await browser.get("/v1/cart").expect(200)).body;
        expect(cart.items.find((item: { productId: string }) => item.productId === ids.bowl).unavailable).toBe(true);
        expect(cart.totals.subtotalCents).toBe(9500);
        expect((await browser.post("/v1/checkout").set(WEB).send(customer).expect(409)).body.code).toBe("CART_HAS_UNAVAILABLE_ITEMS");
      } finally {
        await prisma.product.update({ where: { id: ids.bowl }, data: { published: true } });
      }
    });
  });

  describe("checkout and orders", () => {
    it("validates every field server-side", async () => {
      const browser = agent();
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 1 }).expect(201);
      const invalid = await browser.post("/v1/checkout").set(WEB).send({ ...customer, email: "nope", phone: "12345", addressLine: "", city: "" }).expect(400);
      expect(Object.keys(invalid.body.fields).sort()).toEqual(["addressLine", "city", "email", "phone"]);
      expect((await agent().post("/v1/checkout").set(WEB).send(customer).expect(409)).body.code).toBe("CART_EMPTY");
      const missing = await browser.post("/v1/checkout").set(WEB).send({ firstName: "Salma" }).expect(400);
      expect(missing.body.fields).toMatchObject({ lastName: "Le nom est obligatoire.", city: "La ville est obligatoire." });
    });

    it("says ordering is closed, before validating anything, while checkout is disabled", async () => {
      const config = app.get<AppConfig>(APP_CONFIG);
      const browser = agent();
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 1 }).expect(201);
      expect((await browser.get("/v1/cart").expect(200)).body.checkoutEnabled).toBe(true);
      config.CHECKOUT_ENABLED = false;
      try {
        expect((await browser.get("/v1/cart").expect(200)).body.checkoutEnabled).toBe(false);
        expect((await browser.post("/v1/checkout").set(WEB).send({}).expect(503)).body.code).toBe("CHECKOUT_UNAVAILABLE");
      } finally {
        config.CHECKOUT_ENABLED = true;
      }
      expect(standIn.calls.filter((call) => call.method === "POST")).toHaveLength(0);
    });

    it("reserves every line, snapshots a PENDING order and converts the cart", async () => {
      const browser = agent();
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 2 }).expect(201);
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.glass, quantity: 1 }).expect(201);
      const started = (await browser.post("/v1/checkout").set(WEB).send(customer).expect(201)).body;
      expect(started).toMatchObject({ status: "CREATED", subtotalCents: 58500, shippingCents: 3000, totalCents: 61500, order: null });
      expect(standIn.calls.filter((call) => call.method === "POST")).toHaveLength(0);

      const confirmed = (await browser.post(`/v1/checkout/${started.id}/confirm`).set(WEB).set("X-Request-Id", "checkout-req-0001").expect(201)).body;
      expect(confirmed.status).toBe("RESERVED");
      expect(confirmed.order).toMatchObject({ status: "PENDING", totalCents: 61500, currency: "MAD" });
      expect(confirmed.order.orderNumber).toMatch(/^BB-\d{4}-\d{6}$/);
      expect(confirmed.order.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ productName: "Assiette en grès", sku: "ASSIETTE", unitPriceCents: 24500, quantity: 2, lineTotalCents: 49000 })]));
      expect(standIn.available(catalogue.plate)).toBe(8);
      expect(standIn.available(catalogue.glass)).toBe(4);
      expect([...standIn.reservations.values()].every((value) => value.externalReference === started.reference)).toBe(true);
      const reservationCalls = standIn.calls.filter((call) => call.method === "POST" && call.path === "/api/public/v1/inventory/reservations");
      expect(reservationCalls.every((call) => call.requestId === "checkout-req-0001")).toBe(true);
      expect(new Set(reservationCalls.map((call) => call.idempotencyKey))).toEqual(new Set([
        `bb-reserve:${started.reference}:${catalogue.plate}`, `bb-reserve:${started.reference}:${catalogue.glass}`,
      ]));

      const order = await prisma.order.findFirstOrThrow({ where: { checkoutSessionId: started.id } });
      expect(order).toMatchObject({ email: "salma@example.ma", phone: "+212612345678", city: "Rabat", customerId: null });
      await prisma.product.update({ where: { id: ids.plate }, data: { priceCents: 99900, nameFr: "Assiette renommée" } });
      try {
        const again = (await browser.get(`/v1/checkout/${started.id}`).expect(200)).body;
        expect(again.order.items.find((item: { sku: string }) => item.sku === "ASSIETTE"))
          .toMatchObject({ productName: "Assiette en grès", unitPriceCents: 24500 });
      } finally {
        await prisma.product.update({ where: { id: ids.plate }, data: { priceCents: 24500, nameFr: "Assiette en grès" } });
      }
      const replay = (await browser.post(`/v1/checkout/${started.id}/confirm`).set(WEB).expect(201)).body;
      expect(replay.order.orderNumber).toBe(confirmed.order.orderNumber);
      expect(standIn.reservations.size).toBe(2);
      expect((await browser.get("/v1/cart").expect(200)).body.items).toHaveLength(0);
    });

    it("releases what it reserved when a later line fails", async () => {
      const browser = agent();
      for (const productId of [ids.plate, ids.bowl, ids.glass]) {
        await browser.post("/v1/cart/items").set(WEB).send({ productId, quantity: productId === ids.bowl ? 2 : 1 }).expect(201);
      }
      // The orchestrator reserves by catalogue id order: plate (…01), bowl (…02), glass (…03).
      standIn.rejectReservation.set(catalogue.glass, { status: 409, code: "INVENTORY_INSUFFICIENT_STOCK" });
      const started = (await browser.post("/v1/checkout").set(WEB).send(customer).expect(201)).body;
      const failure = (await browser.post(`/v1/checkout/${started.id}/confirm`).set(WEB).expect(409)).body;
      expect(failure).toMatchObject({ code: "INSUFFICIENT_STOCK", fields: { productId: ids.glass } });
      expect(failure.message).toContain("Verre ciselé");
      expect(JSON.stringify(failure)).not.toContain("INVENTORY_");
      expect(standIn.available(catalogue.plate)).toBe(10);
      expect(standIn.available(catalogue.bowl)).toBe(2);
      const recorded = await prisma.checkoutReservation.findMany({ where: { checkoutId: started.id } });
      expect(recorded.map((value) => value.status)).toEqual(["RELEASED", "RELEASED"]);
      expect((await prisma.checkoutSession.findUniqueOrThrow({ where: { id: started.id } })).status).toBe("FAILED");
      expect(await prisma.order.count({ where: { checkoutSessionId: started.id } })).toBe(0);
      expect((await browser.get("/v1/cart").expect(200)).body.items).toHaveLength(3);
    });

    it("keeps a failed compensation visible for a later retry", async () => {
      const browser = agent();
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 1 }).expect(201);
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.glass, quantity: 1 }).expect(201);
      standIn.rejectReservation.set(catalogue.glass, { status: 404, code: "INVENTORY_ITEM_NOT_REGISTERED" });
      standIn.failRelease.add(catalogue.plate);
      const started = (await browser.post("/v1/checkout").set(WEB).send(customer).expect(201)).body;
      expect((await browser.post(`/v1/checkout/${started.id}/confirm`).set(WEB).expect(409)).body.code).toBe("PRODUCT_UNAVAILABLE");
      const recorded = await prisma.checkoutReservation.findMany({ where: { checkoutId: started.id } });
      expect(recorded.map((value) => value.status)).toEqual(["RELEASE_FAILED"]);
    });

    it("lets only one of two concurrent confirmations reserve", async () => {
      const browser = agent();
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 3 }).expect(201);
      const started = (await browser.post("/v1/checkout").set(WEB).send(customer).expect(201)).body;
      const [first, second] = await Promise.all([
        browser.post(`/v1/checkout/${started.id}/confirm`).set(WEB),
        browser.post(`/v1/checkout/${started.id}/confirm`).set(WEB),
      ]);
      // The loser either sees the attempt in progress (409) or, if it arrives after, the settled result (201).
      expect([first.status, second.status]).toContain(201);
      for (const response of [first, second]) expect([201, 409]).toContain(response.status);
      expect(standIn.available(catalogue.plate)).toBe(7);
      expect(standIn.reservations.size).toBe(1);
      expect(await prisma.order.count({ where: { checkoutSessionId: started.id } })).toBe(1);
    });

    it("refuses another browser and maps outages to a friendly error", async () => {
      const browser = agent();
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.plate, quantity: 1 }).expect(201);
      const started = (await browser.post("/v1/checkout").set(WEB).send(customer).expect(201)).body;
      expect((await agent().get(`/v1/checkout/${started.id}`).expect(404)).body.code).toBe("SESSION_EXPIRED");
      expect((await agent().post(`/v1/checkout/${started.id}/confirm`).set(WEB).expect(404)).body.code).toBe("SESSION_EXPIRED");
      standIn.failures.push({ match: (method) => method === "POST", status: 503 }, { match: (method) => method === "POST", status: 503 });
      const outage = (await browser.post(`/v1/checkout/${started.id}/confirm`).set(WEB).expect(503)).body;
      expect(outage).toEqual({ code: "SERVICE_UNAVAILABLE", message: expect.stringContaining("temporairement indisponible") });
    });

    it("expires an unpaid reserved checkout and cancels its pending order", async () => {
      const browser = agent();
      await browser.post("/v1/cart/items").set(WEB).send({ productId: ids.glass, quantity: 1 }).expect(201);
      const started = (await browser.post("/v1/checkout").set(WEB).send(customer).expect(201)).body;
      await browser.post(`/v1/checkout/${started.id}/confirm`).set(WEB).expect(201);
      await prisma.checkoutSession.update({ where: { id: started.id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
      const expired = (await browser.get(`/v1/checkout/${started.id}`).expect(200)).body;
      expect(expired.status).toBe("EXPIRED");
      expect(expired.order.status).toBe("CANCELLED");
    });
  });
});
