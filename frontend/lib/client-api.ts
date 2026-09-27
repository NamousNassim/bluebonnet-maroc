import type { ApiProblem, Cart, Checkout } from "./types";

export class StorefrontError extends Error {
  constructor(readonly status: number, readonly problem: ApiProblem) { super(problem.message); }
}

export const CART_EVENT = "bb:cart-updated";

/** Browser calls go to the storefront's own origin (/api → Bluebonnet API); never to StartEntreprise. */
async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method, credentials: "same-origin",
    headers: { Accept: "application/json", "X-Bluebonnet-Client": "web", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new StorefrontError(response.status, json ?? { code: "UNAVAILABLE", message: "Service temporairement indisponible. Veuillez réessayer." });
  return json as T;
}

function announce(cart: Cart): Cart {
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: cart.itemCount }));
  return cart;
}

export const fetchCart = () => call<Cart>("GET", "/v1/cart");
export const addToCart = (productId: string, quantity: number) => call<Cart>("POST", "/v1/cart/items", { productId, quantity }).then(announce);
export const updateCartLine = (productId: string, quantity: number) => call<Cart>("PATCH", `/v1/cart/items/${productId}`, { quantity }).then(announce);
export const removeCartLine = (productId: string) => call<Cart>("DELETE", `/v1/cart/items/${productId}`).then(announce);
export const startCheckout = (form: Record<string, string>) => call<Checkout>("POST", "/v1/checkout", form);
export const confirmCheckout = (id: string) => call<Checkout>("POST", `/v1/checkout/${id}/confirm`);
