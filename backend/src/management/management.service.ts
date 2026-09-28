import { createHash } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { StorefrontError } from "../common/storefront-error";
import { APP_CONFIG, AppConfig } from "../config/app-config";
import { PrismaService } from "../prisma/prisma.service";
import {
  categoryCreateSchema, categoryUpdateSchema, listingQuerySchema, parseManagement, PublishInput, publishSchema,
  unpublishSchema, uuid,
} from "./management.schemas";

const withImages = { images: { orderBy: { position: "asc" as const } } };
type ProductRow = Prisma.ProductGetPayload<{ include: typeof withImages }>;
type Tx = Prisma.TransactionClient;

/**
 * Private projection API driven by StartEntreprise (the merchant control plane). A product row is
 * identified by its SalesChannelListing id and only ever moves forward in listing version; stock is
 * never stored here — availability keeps coming live from StartEntreprise.
 */
@Injectable()
export class ManagementService {
  private readonly logger = new Logger("Management");

  constructor(private readonly prisma: PrismaService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  connection() {
    return { storeId: this.config.BLUEBONNET_MANAGEMENT_STORE_ID,
      organizationId: this.config.BLUEBONNET_MANAGEMENT_ORGANIZATION_ID, status: "CONNECTED" };
  }

  async categories() {
    const rows = await this.prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }] });
    return rows.map(categoryView);
  }

  async createCategory(body: unknown) {
    const value = parseManagement(categoryCreateSchema, body, "INVALID_CATEGORY");
    try {
      return categoryView(await this.prisma.category.create({ data: value }));
    } catch (error) {
      throw known(error, { P2002: [HttpStatus.CONFLICT, "INVALID_CATEGORY", "Category slug is already in use."] });
    }
  }

  async updateCategory(id: string, body: unknown) {
    if (!uuid.safeParse(id).success) throw categoryNotFound();
    const value = parseManagement(categoryUpdateSchema, body, "INVALID_CATEGORY");
    try {
      return categoryView(await this.prisma.category.update({ where: { id }, data: value }));
    } catch (error) {
      throw known(error, {
        P2002: [HttpStatus.CONFLICT, "INVALID_CATEGORY", "Category slug is already in use."],
        P2025: [HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category was not found."],
      });
    }
  }

  async publish(listingId: string, body: unknown, idempotencyKey: string | undefined, requestId?: string) {
    requireListingId(listingId);
    const value = parseManagement(publishSchema, body);
    this.requireOrganization(value.organizationId);
    const result = await this.locked(listingId, requireKey(idempotencyKey), { operation: "PUBLISH", listingId, value }, async (tx, hash) => {
      const existing = await tx.product.findUnique({ where: { salesChannelListingId: listingId }, include: withImages });
      if (existing && checkVersion(existing, value.organizationId, value.listingVersion, hash) === "REPLAY") return projection(existing);
      const category = await tx.category.findFirst({ where: { id: value.categoryId, active: true } });
      if (!category) throw new StorefrontError(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_CATEGORY", "Category is missing or inactive.");
      const data = productData(listingId, value, hash, existing?.publishedAt ?? new Date());
      let productId: string;
      try {
        productId = existing
          ? (await tx.product.update({ where: { id: existing.id }, data })).id
          : (await tx.product.create({ data })).id;
      } catch (error) {
        throw known(error, { P2002: [HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_PRODUCT",
          "Slug, SKU or catalogue item is already used by another product."] });
      }
      await reconcileImages(tx, productId, value.images);
      return projection(await tx.product.findUniqueOrThrow({ where: { id: productId }, include: withImages }));
    });
    this.logger.log(`publish listingId=${listingId} version=${value.listingVersion} productId=${result.productId} requestId=${requestId ?? "-"}`);
    return result;
  }

  async unpublish(listingId: string, body: unknown, idempotencyKey: string | undefined, requestId?: string) {
    requireListingId(listingId);
    const value = parseManagement(unpublishSchema, body);
    this.requireOrganization(value.organizationId);
    const result = await this.locked(listingId, requireKey(idempotencyKey), { operation: "UNPUBLISH", listingId, value }, async (tx, hash) => {
      const existing = await tx.product.findUnique({ where: { salesChannelListingId: listingId }, include: withImages });
      if (!existing) throw listingNotFound();
      if (checkVersion(existing, value.organizationId, value.listingVersion, hash) === "REPLAY") return projection(existing);
      // Never deleted: the row, its id and its history survive, and a later publish reuses it.
      return projection(await tx.product.update({ where: { id: existing.id }, include: withImages, data: {
        listingVersion: value.listingVersion, projectionHash: hash, active: false, published: false,
      } }));
    });
    this.logger.log(`unpublish listingId=${listingId} version=${value.listingVersion} productId=${result.productId} requestId=${requestId ?? "-"}`);
    return result;
  }

  async listing(listingId: string, organizationId: string | undefined) {
    requireListingId(listingId);
    const query = parseManagement(listingQuerySchema, { organizationId });
    this.requireOrganization(query.organizationId);
    const product = await this.prisma.product.findFirst({ where: { salesChannelListingId: listingId,
      sourceOrganizationId: query.organizationId }, include: withImages });
    if (!product) throw listingNotFound();
    return projection(product);
  }

  /** Reconciliation read: every projection owned by the organization, published or not. */
  async listings(organizationId: string | undefined) {
    const query = parseManagement(listingQuerySchema, { organizationId });
    this.requireOrganization(query.organizationId);
    const rows = await this.prisma.product.findMany({ where: { sourceOrganizationId: query.organizationId,
      salesChannelListingId: { not: null } }, include: withImages, orderBy: { createdAt: "asc" } });
    return { items: rows.map(projection) };
  }

  private requireOrganization(organizationId: string): void {
    if (organizationId !== this.config.BLUEBONNET_MANAGEMENT_ORGANIZATION_ID) {
      throw new StorefrontError(HttpStatus.FORBIDDEN, "FORBIDDEN", "Organization is not bound to this storefront.");
    }
  }

  /**
   * One transaction per listing write, serialized per listing by an advisory lock. The idempotency
   * record is read and written inside that lock, so a retried job racing its original cannot apply twice.
   */
  private async locked<T>(listingId: string, key: string, request: unknown, operation: (tx: Tx, hash: string) => Promise<T>): Promise<T> {
    const hash = digest(request);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${listingId}, 0))`;
      const replay = await tx.managementIdempotencyRecord.findUnique({ where: { key } });
      if (replay) {
        if (replay.requestHash !== hash) {
          throw new StorefrontError(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Idempotency key was reused with another request.");
        }
        return replay.response as T;
      }
      const response = await operation(tx, hash);
      await tx.managementIdempotencyRecord.create({ data: { key, requestHash: hash, response: response as Prisma.InputJsonValue } });
      return response;
    });
  }
}

/**
 * Versions only move forward. An older version is refused as stale (a delayed StartEntreprise retry
 * can never overwrite newer content); the same version is a no-op replay when identical, a conflict otherwise.
 */
function checkVersion(existing: ProductRow, organizationId: string, requested: number, hash: string): "APPLY" | "REPLAY" {
  if (existing.sourceOrganizationId && existing.sourceOrganizationId !== organizationId) {
    throw new StorefrontError(HttpStatus.FORBIDDEN, "FORBIDDEN", "Listing belongs to another organization.");
  }
  if (existing.listingVersion > requested) {
    throw new StorefrontError(HttpStatus.CONFLICT, "STALE_LISTING_VERSION", "A newer listing version is already projected.",
      { currentVersion: String(existing.listingVersion) });
  }
  if (existing.listingVersion === requested) {
    if (existing.projectionHash === hash) return "REPLAY";
    throw new StorefrontError(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Listing version already has different content.");
  }
  return "APPLY";
}

/** Aligns images by position: changed ones are updated in place, new ones created, stale ones removed. */
async function reconcileImages(tx: Tx, productId: string, images: PublishInput["images"]): Promise<void> {
  const wanted = new Map(images.map((image) => [image.position, image]));
  await tx.productImage.deleteMany({ where: { productId, position: { notIn: [...wanted.keys()] } } });
  const current = new Map((await tx.productImage.findMany({ where: { productId } })).map((image) => [image.position, image]));
  for (const image of [...wanted.values()].sort((left, right) => left.position - right.position)) {
    const data = { url: image.url, altFr: image.altFr, altAr: image.altAr ?? null };
    const existing = current.get(image.position);
    if (!existing) await tx.productImage.create({ data: { ...data, productId, position: image.position } });
    else if (existing.url !== data.url || existing.altFr !== data.altFr || existing.altAr !== data.altAr) {
      await tx.productImage.update({ where: { id: existing.id }, data });
    }
  }
}

function productData(listingId: string, value: PublishInput, hash: string, publishedAt: Date): Prisma.ProductUncheckedCreateInput {
  return {
    salesChannelListingId: listingId, sourceOrganizationId: value.organizationId,
    listingVersion: value.listingVersion, projectionHash: hash,
    startEntrepriseCatalogueId: value.catalogueItemId, slug: value.slug, sku: value.sku,
    nameFr: value.titleFr, nameAr: value.titleAr, shortDescriptionFr: value.shortDescriptionFr,
    shortDescriptionAr: value.shortDescriptionAr, descriptionFr: value.descriptionFr,
    descriptionAr: value.descriptionAr, priceCents: value.publicPriceCents, compareAtPriceCents: null,
    categoryId: value.categoryId, active: true, published: true, featured: value.featured, publishedAt,
    seoTitleFr: value.seoTitleFr, seoTitleAr: value.seoTitleAr,
    seoDescriptionFr: value.seoDescriptionFr, seoDescriptionAr: value.seoDescriptionAr,
  };
}

function projection(product: ProductRow) {
  return {
    productId: product.id, salesChannelListingId: product.salesChannelListingId,
    startEntrepriseCatalogueId: product.startEntrepriseCatalogueId, listingVersion: product.listingVersion,
    published: product.published, active: product.active, slug: product.slug, categoryId: product.categoryId,
    priceCents: product.priceCents, updatedAt: product.updatedAt.toISOString(),
    images: product.images.map((image) => ({ url: image.url, altFr: image.altFr, altAr: image.altAr, position: image.position })),
  };
}

function categoryView(category: { id: string; slug: string; nameFr: string; nameAr: string | null; descriptionFr: string | null;
  descriptionAr: string | null; imageUrl: string | null; active: boolean; sortOrder: number; updatedAt: Date }) {
  return { id: category.id, slug: category.slug, nameFr: category.nameFr, nameAr: category.nameAr,
    descriptionFr: category.descriptionFr, descriptionAr: category.descriptionAr, imageUrl: category.imageUrl,
    active: category.active, sortOrder: category.sortOrder, updatedAt: category.updatedAt.toISOString() };
}

function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function listingNotFound() { return new StorefrontError(HttpStatus.NOT_FOUND, "LISTING_NOT_FOUND", "Listing projection was not found."); }
function categoryNotFound() { return new StorefrontError(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category was not found."); }
function requireListingId(value: string): void {
  if (!uuid.safeParse(value).success) throw new StorefrontError(HttpStatus.BAD_REQUEST, "INVALID_LISTING_ID", "Listing id must be a UUID.");
}
function requireKey(value?: string): string {
  if (!value || value.length > 200) throw new StorefrontError(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.");
  return value;
}
function known(error: unknown, mapping: Record<string, [HttpStatus, string, string]>): Error {
  const entry = mapping[(error as { code?: string })?.code ?? ""];
  if (entry) return new StorefrontError(entry[0], entry[1], entry[2]);
  return error instanceof Error ? error : new Error(String(error));
}
