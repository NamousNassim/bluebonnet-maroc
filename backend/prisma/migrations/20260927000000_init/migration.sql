-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('CREATED', 'RESERVING', 'RESERVED', 'FAILED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReservationLineStatus" AS ENUM ('ACTIVE', 'RELEASED', 'RELEASE_FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CANCELLED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name_fr" VARCHAR(120) NOT NULL,
    "name_ar" VARCHAR(120),
    "description_fr" TEXT,
    "description_ar" TEXT,
    "image_url" VARCHAR(500),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "startentreprise_catalogue_id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name_fr" VARCHAR(200) NOT NULL,
    "name_ar" VARCHAR(200),
    "short_description_fr" VARCHAR(400),
    "short_description_ar" VARCHAR(400),
    "description_fr" TEXT,
    "description_ar" TEXT,
    "sku" VARCHAR(100),
    "price_cents" INTEGER NOT NULL,
    "compare_at_price_cents" INTEGER,
    "category_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(320),
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "alt_fr" VARCHAR(200) NOT NULL,
    "alt_ar" VARCHAR(200),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "cart_id" UUID NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "address_line" VARCHAR(300) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(10),
    "notes" VARCHAR(1000),
    "lines" JSONB NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "shipping_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "reservation_expires_at" TIMESTAMPTZ(3),
    "failure_code" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_reservations" (
    "id" UUID NOT NULL,
    "checkout_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "catalogue_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "startentreprise_reservation_id" UUID NOT NULL,
    "status" "ReservationLineStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checkout_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(30) NOT NULL,
    "checkout_session_id" UUID NOT NULL,
    "customer_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "address_line" VARCHAR(300) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(10),
    "notes" VARCHAR(1000),
    "subtotal_cents" INTEGER NOT NULL,
    "shipping_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "sku" VARCHAR(100),
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_active_sort_order_idx" ON "categories"("active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "products_startentreprise_catalogue_id_key" ON "products"("startentreprise_catalogue_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_published_active_category_id_idx" ON "products"("published", "active", "category_id");

-- CreateIndex
CREATE INDEX "products_published_active_featured_sort_order_idx" ON "products"("published", "active", "featured", "sort_order");

-- CreateIndex
CREATE INDEX "products_published_active_published_at_idx" ON "products"("published", "active", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_position_key" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "carts_token_hash_key" ON "carts"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_reference_key" ON "checkout_sessions"("reference");

-- CreateIndex
CREATE INDEX "checkout_sessions_cart_id_idx" ON "checkout_sessions"("cart_id");

-- CreateIndex
CREATE INDEX "checkout_sessions_status_reservation_expires_at_idx" ON "checkout_sessions"("status", "reservation_expires_at");

-- CreateIndex
CREATE INDEX "checkout_reservations_status_idx" ON "checkout_reservations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_reservations_checkout_id_catalogue_item_id_key" ON "checkout_reservations"("checkout_id", "catalogue_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_checkout_session_id_key" ON "orders"("checkout_session_id");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_reservations" ADD CONSTRAINT "checkout_reservations_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants the database enforces itself (not expressible in Prisma's schema language).
ALTER TABLE "products" ADD CONSTRAINT "ck_products_price" CHECK ("price_cents" > 0),
    ADD CONSTRAINT "ck_products_compare_at" CHECK ("compare_at_price_cents" IS NULL OR "compare_at_price_cents" > "price_cents"),
    ADD CONSTRAINT "ck_products_slug" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    ADD CONSTRAINT "ck_products_published_at" CHECK (NOT "published" OR "published_at" IS NOT NULL);
ALTER TABLE "categories" ADD CONSTRAINT "ck_categories_slug" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "cart_items" ADD CONSTRAINT "ck_cart_items_quantity" CHECK ("quantity" BETWEEN 1 AND 99);
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "ck_checkout_totals" CHECK (
    "subtotal_cents" > 0 AND "shipping_cents" >= 0 AND "total_cents" = "subtotal_cents" + "shipping_cents");
ALTER TABLE "checkout_reservations" ADD CONSTRAINT "ck_checkout_reservations_quantity" CHECK ("quantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_totals" CHECK (
    "subtotal_cents" > 0 AND "shipping_cents" >= 0 AND "total_cents" = "subtotal_cents" + "shipping_cents");
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_line" CHECK (
    "quantity" > 0 AND "unit_price_cents" > 0 AND "line_total_cents" = "unit_price_cents" * "quantity");

-- Gap-tolerant, concurrency-safe order numbering (BB-YYYY-000001).
CREATE SEQUENCE "order_number_seq" START 1;
