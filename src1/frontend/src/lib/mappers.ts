import type {
  AppliedDiscount,
  AppliedDiscountApi,
  CatalogProduct,
  CatalogProductApi,
  ProductSupplierLink,
  ProductSupplierLinkApi,
  PurchaseOrder,
  PurchaseOrderApi,
  PurchaseOrderLine,
  PurchaseOrderLineApi,
  SaleOrder,
  SaleOrderApi,
  SaleOrderLine,
  SaleOrderLineApi,
  StockEntry,
  StockEntryApi,
  StockLedgerEntry,
  StockLedgerEntryApi,
  Warehouse,
  WarehouseApi,
} from "./types";

export function mapCatalogProductApi(product: CatalogProductApi): CatalogProduct {
  return {
    id: product.id,
    sku: product.sku,
    title: product.title,
    author: product.author,
    description: product.description,
    category: product.category,
    isActive: product.is_active,
    sellingPrice: product.selling_price,
    reorderPoint: product.reorder_point,
    createdAt: product.created_at ?? null,
    updatedAt: product.updated_at ?? null,
  };
}

export function mapWarehouseApi(warehouse: WarehouseApi): Warehouse {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    isActive: warehouse.is_active,
    createdAt: warehouse.created_at ?? null,
  };
}

export function mapStockEntryApi(entry: StockEntryApi): StockEntry {
  return {
    productId: entry.product_id,
    sku: entry.sku,
    title: entry.title,
    warehouseCode: entry.warehouse_code,
    onHand: entry.on_hand,
    reserved: entry.reserved,
    reorderPoint: entry.reorder_point,
    sellingPrice: entry.selling_price,
  };
}

export function mapStockLedgerEntryApi(entry: StockLedgerEntryApi): StockLedgerEntry {
  return {
    id: entry.id,
    productId: entry.product_id,
    sku: entry.sku,
    title: entry.title,
    warehouseCode: entry.warehouse_code,
    quantityDelta: entry.quantity_delta,
    movementType: entry.movement_type,
    referenceType: entry.reference_type,
    referenceId: entry.reference_id,
    reason: entry.reason,
    performedBy: entry.performed_by,
    createdAt: entry.created_at,
  };
}

export function mapProductSupplierLinkApi(link: ProductSupplierLinkApi): ProductSupplierLink {
  return {
    supplierId: link.supplier_id,
    supplierName: link.supplier_name,
    supplierSku: link.supplier_sku,
    isPrimary: link.is_primary,
    lastPurchasePrice: link.last_purchase_price,
  };
}

export function mapPurchaseOrderLineApi(line: PurchaseOrderLineApi): PurchaseOrderLine {
  return {
    lineId: line.line_id,
    productId: line.product_id,
    productTitle: line.product_title,
    quantity: line.quantity,
    receivedQuantity: line.received_quantity,
    remainingQuantity: line.remaining_quantity,
    unitCost: line.unit_cost,
  };
}

export function mapPurchaseOrderApi(order: PurchaseOrderApi): PurchaseOrder {
  return {
    id: order.id,
    orderNumber: order.order_number,
    supplierId: order.supplier_id,
    supplierName: order.supplier_name,
    status: order.status,
    orderedAt: order.ordered_at,
    receivedAt: order.received_at ?? null,
    lines: order.lines.map(mapPurchaseOrderLineApi),
  };
}

export function mapSaleOrderLineApi(line: SaleOrderLineApi): SaleOrderLine {
  return {
    lineId: line.line_id,
    productId: line.product_id,
    productName: line.product_name,
    quantity: line.quantity,
    unitPrice: line.unit_price,
    discount: line.discount,
    total: line.total,
  };
}

export function mapAppliedDiscountApi(discount: AppliedDiscountApi): AppliedDiscount {
  return {
    description: discount.description,
    amount: discount.amount,
  };
}

export function mapSaleOrderApi(order: SaleOrderApi): SaleOrder {
  return {
    orderId: order.order_id,
    orderNumber: order.order_number,
    warehouseCode: order.warehouse_code,
    status: order.status,
    createdAt: order.created_at,
    subtotal: order.subtotal,
    discountTotal: order.discount_total,
    total: order.total,
    lines: order.lines.map(mapSaleOrderLineApi),
    discounts: order.discounts.map(mapAppliedDiscountApi),
  };
}
