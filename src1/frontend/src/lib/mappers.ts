import type { BookApi, Book, PurchaseOrderApi, PurchaseOrder, IncomingDeliveryApi, IncomingDelivery, MovementApi, SaleEntry } from "./types";

export function mapBookApiToBook(book: BookApi): Book {
  return {
    ...book,
    purchasePrice: book.purchase_price ?? book.purchasePrice ?? 0,
    sellingPrice: book.sell_price ?? book.sellingPrice ?? 0,
    supplierId: book.supplier_id ?? book.supplierId ?? "",
  };
}

export function mapDraftToBookPayload(
  draft: { name: string; author: string; description: string; purchasePrice: string; sellingPrice: string; quantity: string; sku: string; category: string; supplierId: string; notes: string },
  options?: { id?: string },
): Record<string, string | number | null> {
  return {
    ...(options?.id ? { id: options.id } : {}),
    name: draft.name.trim(),
    author: draft.author.trim(),
    description: draft.description.trim() || "-",
    purchase_price: Number(draft.purchasePrice) || 0,
    sell_price: Number(draft.sellingPrice) || 0,
    quantity: Number(draft.quantity) || 0,
    sku: draft.sku.trim() || `AUTO-${Date.now()}`,
    category: draft.category.trim(),
    supplier_id: draft.supplierId.trim(),
    notes: draft.notes.trim() || null,
  };
}

export function mapPurchaseOrderApiToOrder(order: PurchaseOrderApi): PurchaseOrder {
  return {
    id: order.id,
    supplierId: order.supplier_id,
    supplier: order.supplier_name,
    bookId: order.book_id,
    bookName: order.book_name,
    bookSku: order.book_sku ?? "",
    unitPrice: order.unit_price ?? 0,
    quantity: order.quantity,
    deliveredQuantity: order.delivered_quantity,
    status: order.status,
    createdAt: order.created_at,
    deliveredAt: order.delivered_at ?? undefined,
  };
}

export function mapIncomingDeliveryApi(delivery: IncomingDeliveryApi): IncomingDelivery {
  return {
    id: delivery.id,
    orderId: delivery.order_id,
    supplierId: delivery.supplier_id,
    supplier: delivery.supplier_name,
    bookId: delivery.book_id,
    bookName: delivery.book_name,
    quantity: delivery.quantity,
    unitPrice: delivery.unit_price,
    receivedAt: delivery.received_at,
  };
}

export function parseSaleEntry(movement: MovementApi): SaleEntry | null {
  const reason = movement.reason?.trim() ?? "";
  if (reason.startsWith("Verkauf:")) {
    const detail = reason.slice("Verkauf:".length).trim() || "Ohne Grund";
    const unitPriceMatch = detail.match(/\[price=([0-9]+(?:\.[0-9]+)?)\]$/);
    const unitPrice = unitPriceMatch ? Number(unitPriceMatch[1]) : 0;
    const cleanReason = detail.replace(/\s*\[price=[0-9]+(?:\.[0-9]+)?\]$/, "").trim() || "Ohne Grund";
    const quantity = Math.abs(movement.quantity_change);
    return {
      id: movement.id,
      bookId: movement.book_id,
      bookName: movement.book_name,
      type: "Verkauf",
      quantity,
      unitPrice,
      total: unitPrice * quantity,
      createdAt: movement.timestamp ?? new Date().toISOString(),
      reason: cleanReason,
    };
  }
  if (reason.startsWith("Retoure:")) {
    const detail = reason.slice("Retoure:".length).trim() || "Ohne Grund";
    const unitPriceMatch = detail.match(/\[price=([0-9]+(?:\.[0-9]+)?)\]$/);
    const unitPrice = unitPriceMatch ? Number(unitPriceMatch[1]) : 0;
    const cleanReason = detail.replace(/\s*\[price=[0-9]+(?:\.[0-9]+)?\]$/, "").trim() || "Ohne Grund";
    const quantity = Math.abs(movement.quantity_change);
    return {
      id: movement.id,
      bookId: movement.book_id,
      bookName: movement.book_name,
      type: "Retoure",
      quantity,
      unitPrice,
      total: -unitPrice * quantity,
      createdAt: movement.timestamp ?? new Date().toISOString(),
      reason: cleanReason,
    };
  }
  return null;
}
