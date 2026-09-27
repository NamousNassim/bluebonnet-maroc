import "server-only";
import { cookies, headers } from "next/headers";
import type { ApiProblem, Cart, Category, Checkout, ProductDetail, ProductPage, ProductSort } from "./types";

const API = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: ApiProblem) { super(problem.message); }
}

/**
 * Server-side calls to the Bluebonnet API. The shopper's cart cookie and request id are forwarded;
 * nothing else from the browser is trusted.
 */
async function call<T>(path: string, init: { revalidate?: number; withCart?: boolean } = {}): Promise<T> {
  const requestHeaders: Record<string, string> = { Accept: "application/json" };
  const requestId = (await headers()).get("x-request-id");
  if (requestId) requestHeaders["X-Request-Id"] = requestId;
  if (init.withCart) {
    const cart = (await cookies()).get("bb_cart");
    if (cart) requestHeaders.Cookie = `bb_cart=${cart.value}`;
  }
  const response = await fetch(`${API}${path}`, {
    headers: requestHeaders,
    ...(init.withCart || init.revalidate === undefined ? { cache: "no-store" as const } : { next: { revalidate: init.revalidate } }),
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({ code: "UNAVAILABLE", message: "Service temporairement indisponible." }))) as ApiProblem;
    throw new ApiError(response.status, problem);
  }
  return (await response.json()) as T;
}

export const getCategories = () => call<Category[]>("/v1/categories", { revalidate: 300 });
export const getCategory = (slug: string) => call<Category>(`/v1/categories/${encodeURIComponent(slug)}`, { revalidate: 300 });

/** Availability changes quickly, so product data is only cached for a few seconds. */
export function getProducts(query: { page?: number; size?: number; category?: string; search?: string; sort?: ProductSort; featured?: boolean }) {
  const parameters = new URLSearchParams();
  if (query.page && query.page > 1) parameters.set("page", String(query.page));
  if (query.size) parameters.set("size", String(query.size));
  if (query.category) parameters.set("category", query.category);
  if (query.search) parameters.set("search", query.search);
  if (query.sort) parameters.set("sort", query.sort);
  if (query.featured) parameters.set("featured", "true");
  const suffix = parameters.toString();
  return call<ProductPage>(`/v1/products${suffix ? `?${suffix}` : ""}`, { revalidate: 15 });
}

export const getProduct = (slug: string) => call<ProductDetail>(`/v1/products/${encodeURIComponent(slug)}`, { revalidate: 15 });
export const getSitemap = () => call<{ products: { slug: string; updatedAt: string }[]; categories: { slug: string; updatedAt: string }[] }>("/v1/sitemap", { revalidate: 3600 });
export const getCart = () => call<Cart>("/v1/cart", { withCart: true });
export const getCheckout = (id: string) => call<Checkout>(`/v1/checkout/${encodeURIComponent(id)}`, { withCart: true });
