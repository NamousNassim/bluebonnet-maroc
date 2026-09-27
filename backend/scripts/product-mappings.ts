import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { isDemoCataloguePlaceholder, parseProductMappings } from "../src/catalog/product-mapping";
import { loadConfig } from "../src/config/app-config";
import { TokenProvider } from "../src/integrations/startentreprise/auth";
import { StartEntrepriseClient } from "../src/integrations/startentreprise/client";
import { HttpInventoryGateway } from "../src/integrations/startentreprise/inventory";

interface Options { file?: string; apply: boolean; allowRemap: boolean; preflight: boolean }

function options(argv: string[]): Options {
  const result: Options = { apply: false, allowRemap: false, preflight: false };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--file") result.file = argv[++index];
    else if (value === "--apply") result.apply = true;
    else if (value === "--allow-remap") result.allowRemap = true;
    else if (value === "--preflight") result.preflight = true;
    else throw new Error(`unknown argument: ${value}`);
  }
  if (result.preflight === Boolean(result.file)) {
    throw new Error("choose exactly one operation: --preflight or --file <mapping.json>");
  }
  if (result.preflight && (result.apply || result.allowRemap)) throw new Error("preflight does not accept update flags");
  if (result.allowRemap && !result.apply) throw new Error("--allow-remap requires --apply");
  return result;
}

async function applyMappings(prisma: PrismaClient, file: string, apply: boolean, allowRemap: boolean): Promise<void> {
  const input = parseProductMappings(await readFile(file, "utf8"));
  const products = await prisma.product.findMany({ where: { OR: input.map((entry) => entry.productId
    ? { id: entry.productId } : { slug: entry.slug! }) } });
  const byId = new Map(products.map((product) => [product.id, product]));
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const plan = input.map((entry) => {
    const product = entry.productId ? byId.get(entry.productId) : bySlug.get(entry.slug!);
    if (!product) throw new Error(`product not found: ${entry.productId ?? entry.slug}`);
    return { product, next: entry.startEntrepriseCatalogueId };
  });
  if (new Set(plan.map(({ product }) => product.id)).size !== plan.length) {
    throw new Error("the same product was selected more than once");
  }
  const owners = await prisma.product.findMany({
    where: { startEntrepriseCatalogueId: { in: plan.map(({ next }) => next) } },
    select: { id: true, slug: true, startEntrepriseCatalogueId: true },
  });
  const conflicts = plan.flatMap(({ product, next }) => owners
    .filter((owner) => owner.startEntrepriseCatalogueId === next && owner.id !== product.id));
  if (conflicts.length) {
    throw new Error(`catalogue IDs already mapped to other products: ${conflicts.map((item) => `${item.startEntrepriseCatalogueId} (${item.slug})`).join(", ")}`);
  }
  const remaps = plan.filter(({ product, next }) => product.startEntrepriseCatalogueId !== next);
  if (apply && remaps.length && !allowRemap) {
    throw new Error(`${remaps.length} existing mapping(s) would change; inspect the dry-run and repeat with --apply --allow-remap`);
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", changes: plan.map(({ product, next }) => ({
    productId: product.id, slug: product.slug, from: product.startEntrepriseCatalogueId, to: next,
    action: product.startEntrepriseCatalogueId === next ? "unchanged" : "remap",
  })) }, null, 2));
  if (!apply || !remaps.length) return;
  await prisma.$transaction(remaps.map(({ product, next }) => prisma.product.update({
    where: { id: product.id }, data: { startEntrepriseCatalogueId: next },
  })));
  console.log(`Applied ${remaps.length} mapping change(s).`);
}

async function preflight(prisma: PrismaClient): Promise<void> {
  const config = loadConfig();
  if (!config.STARTENTREPRISE_INTEGRATION_ENABLED) throw new Error("preflight requires STARTENTREPRISE_INTEGRATION_ENABLED=true");
  const products = await prisma.product.findMany({
    where: { active: true, published: true, category: { active: true } },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, startEntrepriseCatalogueId: true },
  });
  if (!products.length) throw new Error("no active published products found");
  const tokens = new TokenProvider({ tokenUrl: config.STARTENTREPRISE_TOKEN_URL!, clientId: config.STARTENTREPRISE_CLIENT_ID!,
    clientSecret: config.STARTENTREPRISE_CLIENT_SECRET!, timeoutMs: config.STARTENTREPRISE_TIMEOUT_MS });
  const gateway = new HttpInventoryGateway(
    new StartEntrepriseClient(config.STARTENTREPRISE_API_URL!, tokens, config.STARTENTREPRISE_TIMEOUT_MS), 0,
  );
  const availability = await gateway.availability(products.map((product) => product.startEntrepriseCatalogueId), `mapping-preflight-${Date.now()}`);
  const report = products.map((product) => {
    const value = availability.get(product.startEntrepriseCatalogueId);
    const placeholder = isDemoCataloguePlaceholder(product.startEntrepriseCatalogueId);
    const classification = placeholder ? "PLACEHOLDER" : value?.status === "IN_STOCK" || value?.status === "LOW_STOCK"
      ? "VALID" : value?.status ?? "UNKNOWN";
    return { ...product, classification, ...(value?.quantityAvailable === undefined ? {} : { quantityAvailable: value.quantityAvailable }) };
  });
  const blockers = report.filter((item) => ["PLACEHOLDER", "NOT_REGISTERED", "NOT_TRACKED", "UNKNOWN"].includes(item.classification));
  console.log(JSON.stringify({ checkoutMappingReady: blockers.length === 0, products: report,
    blockers: blockers.map((item) => ({ slug: item.slug, classification: item.classification })) }, null, 2));
  if (blockers.length) process.exitCode = 2;
}

async function main(): Promise<void> {
  const selected = options(process.argv.slice(2));
  const config = loadConfig();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });
  try {
    if (selected.preflight) await preflight(prisma);
    else await applyMappings(prisma, selected.file!, selected.apply, selected.allowRemap);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
