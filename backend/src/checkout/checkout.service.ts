import { randomBytes } from "node:crypto";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { APP_CONFIG, AppConfig } from "../config/app-config";
import { StorefrontError } from "../common/storefront-error";
import { CartService, hashToken } from "../cart/cart.service";
import { totals } from "../cart/pricing";
import { OrderService, OrderView, orderView } from "../orders/order.service";
import { PrismaService } from "../prisma/prisma.service";
import { CheckoutLine, ReservationFailure, ReservationOrchestrator } from "./reservation-orchestrator";

const MOROCCAN_PHONE = /^(?:\+212|00212|0)([5-7]\d{8})$/;

/** A string field whose absence or wrong type gets the same shopper-facing message as an empty value. */
const text = (message: string) => z.string({ error: message });

export const checkoutSchema = z.object({
  firstName: text("Le prénom est obligatoire.").trim().min(1, "Le prénom est obligatoire.").max(80),
  lastName: text("Le nom est obligatoire.").trim().min(1, "Le nom est obligatoire.").max(80),
  email: text("Adresse e-mail invalide.").trim().toLowerCase().email("Adresse e-mail invalide.").max(254),
  phone: text("Numéro de téléphone marocain invalide.").transform((value) => value.replace(/[\s.()-]/g, ""))
    .refine((value) => MOROCCAN_PHONE.test(value), "Numéro de téléphone marocain invalide.")
    .transform((value) => `+212${MOROCCAN_PHONE.exec(value)![1]}`),
  addressLine: text("L’adresse de livraison est obligatoire.").trim().min(5, "L’adresse de livraison est obligatoire.").max(300),
  city: text("La ville est obligatoire.").trim().min(2, "La ville est obligatoire.").max(100),
  postalCode: text("Code postal invalide.").trim().regex(/^\d{5}$/, "Code postal invalide.").optional().or(z.literal("").transform(() => undefined)),
  notes: text("Instructions invalides.").trim().max(1000, "Instructions trop longues (1000 caractères maximum).").optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export interface CheckoutView {
  id: string; reference: string; status: string; subtotalCents: number; shippingCents: number; totalCents: number;
  reservationExpiresAt: string | null; failureCode: string | null; order: OrderView | null;
}

/**
 * Checkout without payment: capture customer and delivery details against a priced snapshot of the
 * cart, then — on confirmation — reserve stock in StartEntreprise and record a PENDING order.
 * Payment (NAPS) will turn that order into PAID and consume the reservations.
 */
@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService, private readonly carts: CartService, private readonly orders: OrderService,
      private readonly reservations: ReservationOrchestrator, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async start(cartToken: string | undefined, body: unknown): Promise<CheckoutView> {
    // Closed ordering is reported before validation: there is no point correcting a form that cannot be sent.
    this.requireEnabled();
    const input: CheckoutInput = checkoutSchema.parse(body);
    const cart = await this.carts.find(cartToken);
    const items = cart ? await this.prisma.cartItem.findMany({ where: { cartId: cart.id }, orderBy: { createdAt: "asc" },
      include: { product: { include: { category: true } } } }) : [];
    if (!cart || !items.length) throw StorefrontError.conflict("CART_EMPTY", "Votre panier est vide.");
    if (items.some((item) => !item.product.published || !item.product.active || !item.product.category.active)) {
      throw StorefrontError.conflict("CART_HAS_UNAVAILABLE_ITEMS", "Certains articles de votre panier ne sont plus disponibles.");
    }
    const lines: CheckoutLine[] = items.map((item) => ({
      productId: item.product.id, catalogueItemId: item.product.startEntrepriseCatalogueId, name: item.product.nameFr, sku: item.product.sku,
      unitPriceCents: item.product.priceCents, quantity: item.quantity, lineTotalCents: item.product.priceCents * item.quantity,
    }));
    const amount = totals(lines.reduce((sum, line) => sum + line.lineTotalCents, 0), this.config);
    const checkout = await this.prisma.checkoutSession.create({ data: {
      reference: `BB-CHK-${randomBytes(6).toString("hex").toUpperCase()}`, cartId: cart.id,
      firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone,
      addressLine: input.addressLine, city: input.city, postalCode: input.postalCode ?? null, notes: input.notes || null,
      lines: lines as unknown as object, subtotalCents: amount.subtotalCents, shippingCents: amount.shippingCents, totalCents: amount.totalCents,
    }, include: { order: { include: { items: true } } } });
    return view(checkout);
  }

  async confirm(cartToken: string | undefined, checkoutId: string, requestId?: string): Promise<CheckoutView> {
    this.requireEnabled();
    const checkout = await this.owned(cartToken, checkoutId);
    if (checkout.status !== "CREATED") return this.settled(checkout);
    // Claim the attempt: only one concurrent confirmation may reserve.
    const claimed = await this.prisma.checkoutSession.updateMany({ where: { id: checkout.id, status: "CREATED" }, data: { status: "RESERVING" } });
    if (!claimed.count) return this.settled(await this.owned(cartToken, checkoutId));

    const lines = checkout.lines as unknown as CheckoutLine[];
    let expiresAt: Date | null;
    try {
      ({ expiresAt } = await this.reservations.reserveAll(checkout, lines, requestId));
    } catch (error) {
      const failure = error instanceof ReservationFailure ? error : new ReservationFailure("SERVICE_UNAVAILABLE");
      await this.prisma.checkoutSession.update({ where: { id: checkout.id }, data: { status: "FAILED", failureCode: failure.reason } });
      throw shopperError(failure);
    }
    const settled = await this.prisma.$transaction(async (tx) => {
      await this.orders.createFromCheckout(tx, checkout, lines);
      await tx.cart.update({ where: { id: checkout.cartId }, data: { status: "CONVERTED" } });
      return tx.checkoutSession.update({ where: { id: checkout.id }, data: { status: "RESERVED", reservationExpiresAt: expiresAt },
        include: { order: { include: { items: true } } } });
    });
    return view(settled);
  }

  async get(cartToken: string | undefined, checkoutId: string): Promise<CheckoutView> {
    return this.settled(await this.owned(cartToken, checkoutId));
  }

  /** A reserved but unpaid checkout lapses with its reservations; its pending order is cancelled. */
  private async settled(checkout: Awaited<ReturnType<CheckoutService["owned"]>>): Promise<CheckoutView> {
    if (checkout.status === "RESERVED" && checkout.reservationExpiresAt && checkout.reservationExpiresAt < new Date()) {
      const expired = await this.prisma.$transaction(async (tx) => {
        await tx.order.updateMany({ where: { checkoutSessionId: checkout.id, status: "PENDING" }, data: { status: "CANCELLED" } });
        await tx.checkoutReservation.updateMany({ where: { checkoutId: checkout.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
        return tx.checkoutSession.update({ where: { id: checkout.id }, data: { status: "EXPIRED" }, include: { order: { include: { items: true } } } });
      });
      return view(expired);
    }
    if (checkout.status === "RESERVING") throw StorefrontError.conflict("CHECKOUT_IN_PROGRESS", "Votre commande est en cours de validation.");
    return view(checkout);
  }

  /** A checkout is only visible to the browser holding the cart it was started from. */
  private async owned(cartToken: string | undefined, checkoutId: string) {
    if (!cartToken || !z.string().uuid().safeParse(checkoutId).success) throw expiredSession();
    const checkout = await this.prisma.checkoutSession.findFirst({
      where: { id: checkoutId, cart: { tokenHash: hashToken(cartToken) } }, include: { order: { include: { items: true } } },
    });
    if (!checkout) throw expiredSession();
    return checkout;
  }

  private requireEnabled(): void {
    if (!this.config.CHECKOUT_ENABLED) {
      throw StorefrontError.unavailable("CHECKOUT_UNAVAILABLE", "La commande en ligne ouvre très bientôt. Merci de votre patience.");
    }
  }
}

function view(checkout: { id: string; reference: string; status: string; subtotalCents: number; shippingCents: number; totalCents: number;
    reservationExpiresAt: Date | null; failureCode: string | null; order: Parameters<typeof orderView>[0] | null }): CheckoutView {
  return {
    id: checkout.id, reference: checkout.reference, status: checkout.status, subtotalCents: checkout.subtotalCents,
    shippingCents: checkout.shippingCents, totalCents: checkout.totalCents,
    reservationExpiresAt: checkout.reservationExpiresAt?.toISOString() ?? null, failureCode: checkout.failureCode,
    order: checkout.order ? orderView(checkout.order) : null,
  };
}

function expiredSession() {
  return StorefrontError.notFound("SESSION_EXPIRED", "Votre session a expiré. Veuillez reprendre votre commande.");
}

function shopperError(failure: ReservationFailure): StorefrontError {
  const name = failure.line?.name;
  const fields = failure.line ? { productId: failure.line.productId } : undefined;
  switch (failure.reason) {
    case "OUT_OF_STOCK":
      return new StorefrontError(HttpStatus.CONFLICT, "INSUFFICIENT_STOCK", `Stock insuffisant pour « ${name} ». Ajustez la quantité et réessayez.`, fields);
    case "PRODUCT_UNAVAILABLE":
      return new StorefrontError(HttpStatus.CONFLICT, "PRODUCT_UNAVAILABLE", `« ${name} » n’est plus disponible à la commande.`, fields);
    default:
      return StorefrontError.unavailable("SERVICE_UNAVAILABLE", "Service temporairement indisponible. Veuillez réessayer dans quelques instants.");
  }
}
