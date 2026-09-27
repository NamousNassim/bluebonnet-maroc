import { z } from "zod";

const mappingEntry = z.object({
  productId: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(160).optional(),
  startEntrepriseCatalogueId: z.string().uuid(),
}).strict().refine((value) => Number(Boolean(value.productId)) + Number(Boolean(value.slug)) === 1, {
  message: "exactly one of productId or slug is required",
});

const mappingDocument = z.array(mappingEntry).min(1).max(10_000);

export type ProductMappingInput = z.infer<typeof mappingEntry>;

export function parseProductMappings(raw: string): ProductMappingInput[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("mapping file must contain valid JSON");
  }
  const result = mappingDocument.safeParse(json);
  if (!result.success) {
    throw new Error(`invalid mapping file: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  const selectors = new Set<string>();
  const catalogueIds = new Set<string>();
  for (const entry of result.data) {
    const selector = entry.productId ? `id:${entry.productId}` : `slug:${entry.slug}`;
    if (selectors.has(selector)) throw new Error(`duplicate product selector: ${selector}`);
    if (catalogueIds.has(entry.startEntrepriseCatalogueId)) {
      throw new Error(`duplicate StartEntreprise catalogue mapping: ${entry.startEntrepriseCatalogueId}`);
    }
    selectors.add(selector);
    catalogueIds.add(entry.startEntrepriseCatalogueId);
  }
  return result.data;
}

/** The Sprint 1 demo seed owns this reserved UUID range; it must never reach production readiness. */
export function isDemoCataloguePlaceholder(value: string): boolean {
  return /^8b2f3d7e-0a1c-4c55-9a51-00000000000[1-9]$/i.test(value);
}
