import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Idempotent seed. Categories from the brand charter are always ensured. Demo products are only
 * created with SEED_DEMO_PRODUCTS=true (development / browser checks), never implicitly in production.
 * Their StartEntreprise catalogue ids are placeholders until real products are mapped.
 */
const categories = [
  { slug: "vaisselle", nameFr: "Vaisselle", nameAr: "الأواني", descriptionFr: "Assiettes, bols et tasses pour une table élégante au quotidien.", sortOrder: 1 },
  { slug: "verrerie", nameFr: "Verrerie", nameAr: "الزجاجيات", descriptionFr: "Verres et carafes ciselés, pour la lumière de la table.", sortOrder: 2 },
  { slug: "linge-de-table", nameFr: "Linge de table", nameAr: "مفروشات المائدة", descriptionFr: "Nappes, serviettes et chemins de table brodés.", sortOrder: 3 },
  { slug: "decoration", nameFr: "Décoration", nameAr: "الديكور", descriptionFr: "Vases, bougeoirs et objets qui habillent la maison.", sortOrder: 4 },
  { slug: "accessoires", nameFr: "Accessoires", nameAr: "الإكسسوارات", descriptionFr: "Couverts, plateaux et détails qui font la différence.", sortOrder: 5 },
];

const demo = [
  { slug: "assiette-gres-artisanal", category: "vaisselle", nameFr: "Assiette en grès artisanal", nameAr: "صحن من الخزف الحجري", price: 24500, featured: true,
    short: "Grès émaillé, motif bluebonnet peint à la main.", sku: "BB-VAI-001", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000001" },
  { slug: "bol-fleuri-cobalt", category: "vaisselle", nameFr: "Bol fleuri cobalt", nameAr: "وعاء مزهر كوبالت", price: 14500, featured: true,
    short: "Bol en porcelaine au décor floral cobalt.", sku: "BB-VAI-002", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000002" },
  { slug: "tasse-the-lavande", category: "vaisselle", nameFr: "Tasse à thé Lavande", nameAr: "كوب شاي لافندر", price: 11000, compareAt: 13500, featured: false,
    short: "Tasse et soucoupe au liseré lavande.", sku: "BB-VAI-003", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000003" },
  { slug: "verre-cisele-cristal", category: "verrerie", nameFr: "Verre ciselé cristal", nameAr: "كأس كريستال منقوش", price: 9500, featured: true,
    short: "Verre à eau ciselé, lumineux et délicat.", sku: "BB-VER-001", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000004" },
  { slug: "carafe-bluebonnet", category: "verrerie", nameFr: "Carafe Bluebonnet", nameAr: "إبريق بلوبونيت", price: 32000, featured: false,
    short: "Carafe en verre soufflé, gravure florale.", sku: "BB-VER-002", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000005" },
  { slug: "serviette-lin-brodee", category: "linge-de-table", nameFr: "Serviette en lin brodée", nameAr: "منديل كتان مطرز", price: 8500, featured: true,
    short: "Lin lavé, broderie bluebonnet cobalt.", sku: "BB-LIN-001", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000006" },
  { slug: "bougeoir-ceramique-ivoire", category: "decoration", nameFr: "Bougeoir céramique ivoire", nameAr: "شمعدان خزفي عاجي", price: 18500, featured: false,
    short: "Céramique ivoire mate, lignes douces.", sku: "BB-DEC-001", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000007" },
  { slug: "vase-fleurs-des-champs", category: "decoration", nameFr: "Vase Fleurs des champs", nameAr: "مزهرية زهور الحقول", price: 27500, featured: true,
    short: "Vase en grès, décor botanique peint.", sku: "BB-DEC-002", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000008" },
  { slug: "couverts-dores-quatre-pieces", category: "accessoires", nameFr: "Couverts dorés, 4 pièces", nameAr: "طقم أدوات مائدة ذهبي", price: 39000, featured: false,
    short: "Acier inoxydable finition or brossé.", sku: "BB-ACC-001", catalogue: "8b2f3d7e-0a1c-4c55-9a51-000000000009" },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    for (const category of categories) {
      await prisma.category.upsert({ where: { slug: category.slug }, update: {}, create: { ...category, imageUrl: `/images/categories/${category.slug}.svg` } });
    }
    if (process.env.SEED_DEMO_PRODUCTS !== "true") return;
    const bySlug = new Map((await prisma.category.findMany()).map((category) => [category.slug, category.id]));
    const now = Date.now();
    for (const [index, product] of demo.entries()) {
      await prisma.product.upsert({
        where: { slug: product.slug },
        update: {},
        create: {
          slug: product.slug, startEntrepriseCatalogueId: product.catalogue, nameFr: product.nameFr, nameAr: product.nameAr,
          shortDescriptionFr: product.short, descriptionFr: `${product.short} Une pièce Bluebonnet pensée pour sublimer la table au quotidien, `
            + "entre savoir-faire artisanal et inspiration botanique.",
          sku: product.sku, priceCents: product.price, compareAtPriceCents: product.compareAt ?? null, categoryId: bySlug.get(product.category)!,
          published: true, featured: product.featured, sortOrder: index, publishedAt: new Date(now - index * 86_400_000 * 5),
          images: { create: [
            { url: `/images/products/${product.category}.svg`, altFr: product.nameFr, altAr: product.nameAr, position: 0 },
            { url: `/images/products/${product.category}-detail.svg`, altFr: `${product.nameFr} — détail`, position: 1 },
          ] },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
