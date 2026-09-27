import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { CheckoutLine } from "../checkout/reservation-orchestrator";

type Tx = Prisma.TransactionClient;

export interface OrderView {
  orderNumber: string; status: string; currency: string; subtotalCents: number; shippingCents: number; totalCents: number;
  createdAt: string; items: { productName: string; sku: string | null; unitPriceCents: number; quantity: number; lineTotalCents: number }[];
}

/** Orders are immutable commercial snapshots: names, SKUs and prices are copied, never re-read. */
@Injectable()
export class OrderService {
  async createFromCheckout(tx: Tx, checkout: {
    id: string; firstName: string; lastName: string; email: string; phone: string; addressLine: string; city: string;
    postalCode: string | null; notes: string | null; subtotalCents: number; shippingCents: number; totalCents: number;
  }, lines: CheckoutLine[]) {
    const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_number_seq')`;
    const orderNumber = `BB-${new Date().getUTCFullYear()}-${String(nextval).padStart(6, "0")}`;
    return tx.order.create({
      data: {
        orderNumber, checkoutSessionId: checkout.id, status: "PENDING",
        firstName: checkout.firstName, lastName: checkout.lastName, email: checkout.email, phone: checkout.phone,
        addressLine: checkout.addressLine, city: checkout.city, postalCode: checkout.postalCode, notes: checkout.notes,
        subtotalCents: checkout.subtotalCents, shippingCents: checkout.shippingCents, totalCents: checkout.totalCents,
        items: { create: lines.map((line) => ({
          productId: line.productId, productName: line.name, sku: line.sku, unitPriceCents: line.unitPriceCents,
          quantity: line.quantity, lineTotalCents: line.lineTotalCents,
        })) },
      },
      include: { items: true },
    });
  }
}

export function orderView(order: { orderNumber: string; status: string; currency: string; subtotalCents: number; shippingCents: number;
    totalCents: number; createdAt: Date; items: { productName: string; sku: string | null; unitPriceCents: number; quantity: number; lineTotalCents: number }[] }): OrderView {
  return {
    orderNumber: order.orderNumber, status: order.status, currency: order.currency, subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents, totalCents: order.totalCents, createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({ productName: item.productName, sku: item.sku, unitPriceCents: item.unitPriceCents, quantity: item.quantity, lineTotalCents: item.lineTotalCents })),
  };
}
