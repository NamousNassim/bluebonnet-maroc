import { HttpStatus } from "@nestjs/common";
import { z, ZodError, ZodType } from "zod";
import { StorefrontError } from "../common/storefront-error";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);
const slug = (max: number) => z.string().trim().min(1).max(max).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * Images are references, never bytes: an https URL (StartEntreprise media) or a path served by the
 * storefront itself. Anything else (javascript:, data:, plain http:) is refused.
 */
const imageUrl = z.string().trim().max(500).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "image URL must be https or a storefront path");

export const imageSchema = z.object({
  url: imageUrl,
  altFr: z.string().trim().min(1).max(200),
  altAr: nullableText(200),
  position: z.number().int().min(0).max(99),
});

export const publishSchema = z.object({
  organizationId: z.string().uuid(),
  listingVersion: z.number().int().min(1),
  catalogueItemId: z.string().uuid(),
  slug: slug(160),
  sku: nullableText(100),
  titleFr: z.string().trim().min(1).max(200),
  titleAr: nullableText(200),
  shortDescriptionFr: nullableText(400),
  shortDescriptionAr: nullableText(400),
  descriptionFr: nullableText(10_000),
  descriptionAr: nullableText(10_000),
  publicPriceCents: z.number().int().positive().max(100_000_000),
  categoryId: z.string().uuid(),
  featured: z.boolean().default(false),
  seoTitleFr: nullableText(200),
  seoTitleAr: nullableText(200),
  seoDescriptionFr: nullableText(320),
  seoDescriptionAr: nullableText(320),
  images: z.array(imageSchema).max(12).refine((images) => new Set(images.map((image) => image.position)).size === images.length,
    "image positions must be unique"),
});

export const unpublishSchema = z.object({
  organizationId: z.string().uuid(),
  listingVersion: z.number().int().min(1),
});

export const listingQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const categoryCreateSchema = z.object({
  slug: slug(120),
  nameFr: z.string().trim().min(1).max(120),
  nameAr: nullableText(120),
  descriptionFr: nullableText(2_000),
  descriptionAr: nullableText(2_000),
  imageUrl: imageUrl.nullable().optional().transform((value) => value || null),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().refine((value) => Object.keys(value).length > 0,
  "at least one category field is required");

export const uuid = z.string().uuid();

export type PublishInput = z.infer<typeof publishSchema>;
export type UnpublishInput = z.infer<typeof unpublishSchema>;

/**
 * Parses a management payload and turns validation failures into the stable, machine-readable codes
 * StartEntreprise classifies on (INVALID_PRICE, INVALID_IMAGE, INVALID_CATEGORY, INVALID_PRODUCT).
 */
export function parseManagement<T>(schema: ZodType<T>, body: unknown, fallbackCode = "INVALID_PRODUCT"): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    const fields: Record<string, string> = {};
    for (const issue of error.issues) fields[issue.path.join(".") || "body"] ??= issue.message;
    const first = String(error.issues[0]?.path[0] ?? "");
    const code = first === "publicPriceCents" ? "INVALID_PRICE"
      : first === "images" ? "INVALID_IMAGE"
        : first === "categoryId" ? "INVALID_CATEGORY"
          : fallbackCode;
    throw new StorefrontError(HttpStatus.UNPROCESSABLE_ENTITY, code, "The management payload is invalid.", fields);
  }
}
