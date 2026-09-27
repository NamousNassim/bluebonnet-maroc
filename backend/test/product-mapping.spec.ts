import { isDemoCataloguePlaceholder, parseProductMappings } from "../src/catalog/product-mapping";

describe("product mapping import validation", () => {
  const catalogueA = "11111111-1111-4111-8111-111111111111";
  const catalogueB = "22222222-2222-4222-8222-222222222222";

  it("accepts explicit slug or product-id selectors", () => {
    expect(parseProductMappings(JSON.stringify([
      { slug: "assiette", startEntrepriseCatalogueId: catalogueA },
      { productId: catalogueB, startEntrepriseCatalogueId: "33333333-3333-4333-8333-333333333333" },
    ]))).toHaveLength(2);
  });

  it("rejects malformed UUIDs, ambiguous selectors and duplicate catalogue mappings", () => {
    expect(() => parseProductMappings(JSON.stringify([{ slug: "x", startEntrepriseCatalogueId: "sku-1" }]))).toThrow("invalid mapping file");
    expect(() => parseProductMappings(JSON.stringify([{
      slug: "x", productId: catalogueB, startEntrepriseCatalogueId: catalogueA,
    }]))).toThrow("exactly one");
    expect(() => parseProductMappings(JSON.stringify([
      { slug: "x", startEntrepriseCatalogueId: catalogueA },
      { slug: "y", startEntrepriseCatalogueId: catalogueA },
    ]))).toThrow("duplicate StartEntreprise catalogue mapping");
  });

  it("recognizes only the reserved demo UUID range as placeholder data", () => {
    expect(isDemoCataloguePlaceholder("8b2f3d7e-0a1c-4c55-9a51-000000000001")).toBe(true);
    expect(isDemoCataloguePlaceholder(catalogueA)).toBe(false);
  });
});
