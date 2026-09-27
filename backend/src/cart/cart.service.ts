import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { APP_CONFIG, AppConfig } from "../config/app-config";
import { StorefrontError } from "../common/storefront-error";
import { AvailabilityService, DisplayAvailability } from "../catalog/availability.service";
import { PrismaService } from "../prisma/prisma.service";
import { Totals, totals } from "./pricing";

export const MAX_LINE_QUANTITY = 99;
export const addItemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY) });
export const setQuantitySchema = z.object({ quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY) });

export interface CartLineView {
  productId: string; slug: string; nameFr: string; nameAr: string | null; imageUrl: string | null; sku: string | null;
  unitPriceCents: number; quantity: number; lineTotalCents: number;
  /** Informational only: adding to the cart never reserves stock. */
  availability: DisplayAvailability;
  /** Product unpublished since it was added: excluded from totals and blocks checkout. */
  unavailable: boolean;
}
/** checkoutEnabled lets the storefront say up front that online ordering is not open yet. */
export interface CartView { items: CartLineView[]; itemCount: number; totals: Totals; checkoutEnabled: boolean }

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService, private readonly availability: AvailabilityService,
      @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** The active cart for this cookie token, or null. */
  async find(token: string | undefined) {
    if (!token) return null;
    return this.prisma.cart.findFirst({ where: { tokenHash: hashToken(token), status: "ACTIVE" } });
  }

  async view(token: string | undefined, requestId?: string): Promise<CartView> {
    const cart = await this.find(token);
    return cart ? this.render(cart.id, requestId) : { items: [], itemCount: 0, totals: totals(0, this.config), checkoutEnabled: this.config.CHECKOUT_ENABLED };
  }

  /** Adds (or increases) a line; creates the cart and a new token when needed. */
  async add(token: string | undefined, input: z.infer<typeof addItemSchema>, requestId?: string): Promise<{ token: string; cart: CartView }> {
    await this.purchasable(input.productId);
    let cart = await this.find(token);
    let activeToken = token;
    if (!cart) {
      activeToken = newToken();
      cart = await this.prisma.cart.create({ data: { tokenHash: hashToken(activeToken) } });
    }
    const existing = await this.prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId: input.productId } } });
    const quantity = (existing?.quantity ?? 0) + input.quantity;
    if (quantity > MAX_LINE_QUANTITY) throw StorefrontError.badRequest("QUANTITY_LIMIT", `La quantité est limitée à ${MAX_LINE_QUANTITY} par article.`);
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: input.productId } },
      create: { cartId: cart.id, productId: input.productId, quantity },
      update: { quantity },
    });
    await this.touch(cart.id);
    return { token: activeToken!, cart: await this.render(cart.id, requestId) };
  }

  async setQuantity(token: string | undefined, productId: string, quantity: number, requestId?: string): Promise<CartView> {
    const cart = await this.requireCart(token);
    const updated = await this.prisma.cartItem.updateMany({ where: { cartId: cart.id, productId }, data: { quantity } });
    if (!updated.count) throw StorefrontError.notFound("CART_ITEM_NOT_FOUND", "Cet article n’est plus dans votre panier.");
    await this.touch(cart.id);
    return this.render(cart.id, requestId);
  }

  async remove(token: string | undefined, productId: string, requestId?: string): Promise<CartView> {
    const cart = await this.requireCart(token);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    await this.touch(cart.id);
    return this.render(cart.id, requestId);
  }

  async clear(token: string | undefined): Promise<CartView> {
    const cart = await this.find(token);
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { items: [], itemCount: 0, totals: totals(0, this.config), checkoutEnabled: this.config.CHECKOUT_ENABLED };
  }

  /** Priced lines straight from current product data; the browser never supplies a price. */
  async render(cartId: string, requestId?: string): Promise<CartView> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId }, orderBy: { createdAt: "asc" },
      include: { product: { include: { category: true, images: { orderBy: { position: "asc" }, take: 1 } } } },
    });
    const availability = await this.availability.forCatalogueIds(items.map((item) => item.product.startEntrepriseCatalogueId), requestId);
    const lines = items.map((item): CartLineView => {
      const product = item.product;
      const unavailable = !product.published || !product.active || !product.category.active;
      return {
        productId: product.id, slug: product.slug, nameFr: product.nameFr, nameAr: product.nameAr, imageUrl: product.images[0]?.url ?? null,
        sku: product.sku, unitPriceCents: product.priceCents, quantity: item.quantity, lineTotalCents: product.priceCents * item.quantity,
        availability: availability.get(product.startEntrepriseCatalogueId) ?? { state: "UNKNOWN" }, unavailable,
      };
    });
    const subtotal = lines.filter((line) => !line.unavailable).reduce((sum, line) => sum + line.lineTotalCents, 0);
    return { items: lines, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), totals: totals(subtotal, this.config), checkoutEnabled: this.config.CHECKOUT_ENABLED };
  }

  private async purchasable(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, published: true, active: true, category: { active: true } } });
    if (!product) throw StorefrontError.notFound("PRODUCT_UNAVAILABLE", "Ce produit n’est pas disponible.");
  }

  private async requireCart(token: string | undefined) {
    const cart = await this.find(token);
    if (!cart) throw StorefrontError.notFound("CART_NOT_FOUND", "Votre panier a expiré ou est vide.");
    return cart;
  }

  private touch(cartId: string) {
    return this.prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  }
}
