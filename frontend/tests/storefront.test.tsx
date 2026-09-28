import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cart, category, detail, product } from "./fixtures";

const push = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/", notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, redirect: vi.fn(),
}));
vi.mock("@/lib/locale", async () => {
  const { dictionaries } = await import("@/lib/i18n");
  return { getLocale: async () => "fr", getDictionary: async () => ({ locale: "fr", t: dictionaries.fr }), SITE_URL: "https://bluebonnetmaroc.com" };
});
const api = vi.hoisted(() => ({
  getCategories: vi.fn(), getCategory: vi.fn(), getProducts: vi.fn(), getProduct: vi.fn(), getCart: vi.fn(), getCheckout: vi.fn(), getSitemap: vi.fn(),
}));
vi.mock("@/lib/server-api", () => ({ ...api, ApiError: class extends Error { constructor(readonly status: number) { super("api"); } } }));

import { AddToCart } from "@/components/add-to-cart";
import { CartView } from "@/components/cart-view";
import { CheckoutForm } from "@/components/checkout-form";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { dictionaries } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import HomePage from "@/app/page";
import CategoryPage from "@/app/categorie/[slug]/page";
import ProductPage from "@/app/produits/[slug]/page";

const t = dictionaries.fr;
type Handler = (method: string, url: string, body: unknown) => { status: number; json: unknown };
let handler: Handler;
const calls: { method: string; url: string; body: unknown; headers: Record<string, string> }[] = [];

beforeEach(() => {
  calls.length = 0; push.mockReset();
  handler = () => ({ status: 200, json: cart(0, { items: [], itemCount: 0 }) });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: init.method ?? "GET", url, body, headers: (init.headers ?? {}) as Record<string, string> });
    const { status, json } = handler(init.method ?? "GET", url, body);
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  }));
  api.getCategories.mockResolvedValue([category]);
  api.getCategory.mockResolvedValue(category);
  api.getProducts.mockResolvedValue({ items: [product(), product({ id: "p2", slug: "bol", nameFr: "Bol fleuri cobalt", isNew: false, availability: { state: "LOW_STOCK", remaining: 3 } })], page: 1, size: 12, total: 2, totalPages: 1 });
  api.getProduct.mockResolvedValue(detail());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("formatting", () => {
  it("formats centimes as dirhams without ambiguous grouping", () => {
    expect(formatPrice(24500)).toBe("245 DH");
    expect(formatPrice(24550)).toBe("245,5 DH");
    expect(formatPrice(1_234_500).replace(/\s/g, " ")).toBe("12 345 DH");
    expect(formatPrice(24500, "ar")).toBe("245 درهم");
  });
});

describe("homepage", () => {
  it("renders the editorial launch experience without invented products", async () => {
    const { container } = render(await HomePage());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t.heroTitle);
    expect(screen.getByRole("heading", { name: t.categoriesTitle })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Vaisselle/ }).getAttribute("href")).toBe("/categorie/vaisselle");
    expect(screen.getByRole("heading", { name: t.collectionTitle })).toBeTruthy();
    expect(screen.queryByText("Assiette en grès artisanal")).toBeNull();
    expect(container.querySelector("#inspirations")).not.toBeNull();
    expect(api.getProducts).not.toHaveBeenCalled();
  });

  it("does not depend on catalogue inventory to tell the brand story", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByText(t.comingSoon)).toBeTruthy();
  });
});

describe("category listing", () => {
  it("lists the category's products with filters, and breadcrumb JSON-LD", async () => {
    const { container } = render(await CategoryPage({ params: Promise.resolve({ slug: "vaisselle" }), searchParams: Promise.resolve({ sort: "price_asc" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Vaisselle");
    expect(api.getProducts).toHaveBeenCalledWith(expect.objectContaining({ category: "vaisselle", sort: "price_asc" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Vaisselle", current: "page" })).toBeTruthy();
    const ld = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld["@type"]).toBe("BreadcrumbList");
  });

  it("returns not-found for an unknown category", async () => {
    const { ApiError } = await import("@/lib/server-api");
    api.getCategory.mockRejectedValue(new (ApiError as unknown as new (status: number) => Error)(404));
    await expect(CategoryPage({ params: Promise.resolve({ slug: "nope" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("product card", () => {
  it("shows price, bilingual name, badge and coarse availability — never raw stock", () => {
    render(<ProductCard product={product({ availability: { state: "LOW_STOCK", remaining: 2 }, compareAtPriceCents: 30000 })} locale="fr" t={t} />);
    const card = screen.getByRole("article");
    expect(within(card).getByRole("link").getAttribute("href")).toBe("/produits/assiette-gres-artisanal");
    expect(card.textContent).toContain("245 DH");
    expect(card.textContent).toContain("300 DH");
    expect(card.textContent).toContain("صحن من الخزف الحجري");
    expect(card.textContent).toContain(t.newBadge);
    expect(card.textContent).toContain("Plus que 2 disponibles");
  });

  it("uses Arabic names in Arabic and explains unknown availability", () => {
    render(<ProductCard product={product({ availability: { state: "UNKNOWN" } })} locale="ar" t={dictionaries.ar} />);
    expect(screen.getByRole("link").textContent).toBe("صحن من الخزف الحجري");
    expect(screen.getByRole("article").textContent).toContain(dictionaries.ar.unknownStock);
  });
});

describe("product detail", () => {
  it("renders gallery, price, add to cart and Product + Breadcrumb JSON-LD", async () => {
    const { container } = render(await ProductPage({ params: Promise.resolve({ slug: "assiette-gres-artisanal" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Assiette en grès artisanal");
    expect(screen.getAllByRole("button", { pressed: false }).length + screen.getAllByRole("button", { pressed: true }).length).toBeGreaterThanOrEqual(2);
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent!));
    const productLd = ld.find((entry) => entry["@type"] === "Product");
    expect(productLd.offers).toMatchObject({ priceCurrency: "MAD", price: "245.00", availability: "https://schema.org/InStock" });
    expect(productLd.image[0]).toBe("https://bluebonnetmaroc.com/images/products/vaisselle.svg");
    expect(ld.some((entry) => entry["@type"] === "BreadcrumbList")).toBe(true);
    expect((screen.getByRole("button", { name: /Ajouter au panier/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("exposes canonical and Open Graph metadata", async () => {
    const { generateMetadata } = await import("@/app/produits/[slug]/page");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "assiette-gres-artisanal" }) });
    expect(metadata.alternates?.canonical).toBe("/produits/assiette-gres-artisanal");
    expect(metadata.openGraph?.title).toBe("Assiette en grès artisanal | Bluebonnet");
  });

  it("disables add to cart when out of stock", async () => {
    api.getProduct.mockResolvedValue(detail({ availability: { state: "OUT_OF_STOCK" } }));
    render(await ProductPage({ params: Promise.resolve({ slug: "x" }) }));
    expect((screen.getByRole("button", { name: /Ajouter au panier/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("add to cart", () => {
  it("sends only product id and quantity, with the client header, and announces the cart", async () => {
    handler = () => ({ status: 200, json: cart(3) });
    const announced = vi.fn();
    window.addEventListener("bb:cart-updated", (event) => announced((event as CustomEvent).detail));
    render(<AddToCart productId="p1" disabled={false} locale="fr" />);
    await userEvent.click(screen.getByRole("button", { name: "+1" }));
    await userEvent.click(screen.getByRole("button", { name: "+1" }));
    await userEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    expect(await screen.findByText(t.added)).toBeTruthy();
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/v1/cart/items", body: { productId: "p1", quantity: 3 } });
    expect(calls[0].headers["X-Bluebonnet-Client"]).toBe("web");
    expect(announced).toHaveBeenCalledWith(3);
  });

  it("shows the server's refusal", async () => {
    handler = () => ({ status: 409, json: { code: "QUANTITY_LIMIT", message: "Quantité maximale atteinte." } });
    render(<AddToCart productId="p1" disabled={false} locale="fr" />);
    await userEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Quantité maximale atteinte.");
  });
});

describe("cart", () => {
  it("shows an empty state", () => {
    render(<CartView initial={cart(0, { items: [], itemCount: 0 })} locale="fr" />);
    expect(screen.getByText(t.cartEmpty)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.continueShopping }).getAttribute("href")).toBe("/produits");
  });

  it("updates quantities through the API and displays the server's totals", async () => {
    // The server applies free shipping; the view must not recompute anything itself.
    handler = (method) => method === "PATCH" ? { status: 200, json: cart(4, { totals: { subtotalCents: 98000, shippingCents: 0, totalCents: 98000, freeShippingFromCents: 80000 } }) } : { status: 200, json: cart(2) };
    render(<CartView initial={cart(2)} locale="fr" />);
    const summary = screen.getByRole("complementary");
    expect(summary.textContent).toContain("520 DH");
    expect(summary.textContent).toContain(t.freeShippingHint("800 DH"));
    await userEvent.click(within(screen.getByRole("group")).getByRole("button", { name: "+1" }));
    await waitFor(() => expect(summary.textContent).toContain(t.shippingFree));
    expect(calls[0]).toMatchObject({ method: "PATCH", url: "/api/v1/cart/items/p1", body: { quantity: 3 } });
    expect(summary.textContent).toContain("980 DH");
  });

  it("removes a line and blocks checkout while a line is unavailable", async () => {
    const blocked = cart(1);
    blocked.items[0] = { ...blocked.items[0], unavailable: true };
    handler = () => ({ status: 200, json: cart(0, { items: [], itemCount: 0 }) });
    render(<CartView initial={blocked} locale="fr" />);
    expect(screen.queryByRole("link", { name: /Passer commande/ })).toBeNull();
    expect((screen.getByRole("button", { name: t.checkout }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: t.remove }));
    expect(await screen.findByText(t.cartEmpty)).toBeTruthy();
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "/api/v1/cart/items/p1" });
  });
});

describe("closed ordering", () => {
  it("tells shoppers up front, in the cart and on the checkout form", () => {
    render(<CartView initial={{ ...cart(1), checkoutEnabled: false }} locale="fr" />);
    expect(screen.getByRole("note").textContent).toBe(t.checkoutClosed);
    expect((screen.getByRole("button", { name: t.checkout }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    render(<CheckoutForm locale="fr" enabled={false} />);
    expect(screen.getByRole("note").textContent).toBe(t.checkoutClosed);
    expect((screen.getByRole("button", { name: t.placeOrder }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("checkout form", () => {
  const fill = async () => {
    await userEvent.type(screen.getByLabelText(t.firstName), "Salma");
    await userEvent.type(screen.getByLabelText(t.lastName), "Bennani");
    await userEvent.type(screen.getByLabelText(t.email), "salma@example.ma");
    await userEvent.type(screen.getByLabelText(t.phone), "0612345678");
    await userEvent.type(screen.getByLabelText(t.address), "12 rue des Orangers");
    await userEvent.type(screen.getByLabelText(t.city), "Casablanca");
  };

  it("shows server field errors next to the fields", async () => {
    handler = () => ({ status: 400, json: { code: "VALIDATION_FAILED", message: "Vérifiez les informations saisies.", fields: { email: "Adresse e-mail invalide." } } });
    render(<CheckoutForm locale="fr" />);
    await userEvent.click(screen.getByRole("button", { name: t.placeOrder }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Vérifiez");
    expect(document.activeElement).toBe(alert);
    expect(screen.getByLabelText(t.email).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Adresse e-mail invalide.")).toBeTruthy();
  });

  it("starts, confirms and opens the order page — never sending prices", async () => {
    handler = (method, url) => url.endsWith("/confirm")
      ? { status: 200, json: { id: "chk-1", status: "RESERVED" } }
      : { status: 201, json: { id: "chk-1", status: "CREATED" } };
    render(<CheckoutForm locale="fr" />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: t.placeOrder }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/commande/chk-1"));
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(["POST /api/v1/checkout", "POST /api/v1/checkout/chk-1/confirm"]);
    expect(JSON.stringify(calls[0].body)).not.toMatch(/price|total|cents/i);
  });

  it("explains stock problems and links back to the cart", async () => {
    handler = (method, url) => url.endsWith("/confirm")
      ? { status: 409, json: { code: "INSUFFICIENT_STOCK", message: "Stock insuffisant pour « Assiette ».", fields: { productId: "p1" } } }
      : { status: 201, json: { id: "chk-1", status: "CREATED" } };
    render(<CheckoutForm locale="fr" />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: t.placeOrder }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Stock insuffisant");
    expect(within(alert).getByRole("link", { name: t.viewCart }).getAttribute("href")).toBe("/panier");
    expect(push).not.toHaveBeenCalled();
  });

  it("reports that online ordering is not open yet", async () => {
    handler = () => ({ status: 503, json: { code: "CHECKOUT_UNAVAILABLE", message: "La commande en ligne ouvre très bientôt. Merci de votre patience." } });
    render(<CheckoutForm locale="fr" />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: t.placeOrder }));
    expect((await screen.findByRole("alert")).textContent).toContain("ouvre très bientôt");
  });
});

describe("navigation", () => {
  it("links to the storefront sections, shows the cart count and hides unbuilt features", async () => {
    handler = () => ({ status: 200, json: cart(2) });
    render(<Header locale="fr" />);
    const nav = screen.getByRole("navigation", { name: t.menu });
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/produits?sort=new", "/produits", "/categorie/vaisselle", "/categorie/verrerie", "/categorie/linge-de-table", "/#inspirations"]);
    expect(await screen.findByRole("link", { name: `${t.cart} (2)` })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /compte|account|favoris|wishlist/i })).toBeNull();
  });

  it("switches language through the locale cookie", async () => {
    render(<Header locale="fr" />);
    await userEvent.click(screen.getAllByRole("button", { name: "AR" })[0]);
    expect(document.cookie).toContain("bb_locale=ar");
  });
});
