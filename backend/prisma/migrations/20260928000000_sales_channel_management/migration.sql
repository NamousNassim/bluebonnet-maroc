ALTER TABLE "products"
    ADD COLUMN "sales_channel_listing_id" UUID,
    ADD COLUMN "source_organization_id" UUID,
    ADD COLUMN "listing_version" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "projection_hash" CHAR(64),
    ADD COLUMN "seo_title_ar" VARCHAR(200),
    ADD COLUMN "seo_description_ar" VARCHAR(320);

CREATE UNIQUE INDEX "products_sales_channel_listing_id_key"
    ON "products"("sales_channel_listing_id");

CREATE TABLE "management_idempotency_records" (
    "key" VARCHAR(200) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "management_idempotency_records_pkey" PRIMARY KEY ("key")
);

COMMENT ON COLUMN "products"."sales_channel_listing_id" IS
    'Authoritative StartEntreprise SalesChannelListing id; null only on legacy/manual rows.';
