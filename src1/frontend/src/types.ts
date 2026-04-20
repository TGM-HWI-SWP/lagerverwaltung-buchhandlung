export type CatalogProductApi = {
  id: string;
  sku: string;
  title: string;
  author: string;
  description: string;
  category: string;
  is_active: boolean;
  selling_price: number;
  reorder_point: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CatalogProduct = {
  id: string;
  sku: string;
  title: string;
  author: string;
  description: string;
  category: string;
  isActive: boolean;
  sellingPrice: number;
  reorderPoint: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CatalogProductDraft = {
  sku: string;
  title: string;
  author: string;
  description: string;
  category: string;
  sellingPrice: string;
  reorderPoint: string;
};

export type LocationFieldsApi = {
  location_display_name: string;
  location_street: string;
  location_house_number: string;
  location_postcode: string;
  location_city: string;
  location_state: string;
  location_country: string;
  location_lat: string;
  location_lon: string;
  location_source: string;
  location_source_id: string;
};

export type LocationFields = {
  locationDisplayName: string;
  locationStreet: string;
  locationHouseNumber: string;
  locationPostcode: string;
  locationCity: string;
  locationState: string;
  locationCountry: string;
  locationLat: string;
  locationLon: string;
  locationSource: string;
  locationSourceId: string;
};

export type WarehouseApi = LocationFieldsApi & {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at?: string | null;
};

export type Warehouse = LocationFields & {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt?: string | null;
};

export type WarehouseDraft = {
  code: string;
  name: string;
  locationDisplayName: string;
  locationStreet: string;
  locationHouseNumber: string;
  locationPostcode: string;
  locationCity: string;
  locationState: string;
  locationCountry: string;
  locationLat: string;
  locationLon: string;
};

export type StockEntryApi = {
  product_id: string;
  sku: string;
  title: string;
  warehouse_code: string;
  on_hand: number;
  reserved: number;
  reorder_point: number;
  selling_price: number;
};

export type StockEntry = {
  productId: string;
  sku: string;
  title: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  reorderPoint: number;
  sellingPrice: number;
};

export type StockLedgerEntryApi = {
  id: string;
  product_id: string;
  sku: string;
  title: string;
  warehouse_code: string;
  quantity_delta: number;
  movement_type: string;
  reference_type: string;
  reference_id: string;
  reason: string;
  performed_by: string;
  created_at: string;
};

export type StockLedgerEntry = {
  id: string;
  productId: string;
  sku: string;
  title: string;
  warehouseCode: string;
  quantityDelta: number;
  movementType: string;
  referenceType: string;
  referenceId: string;
  reason: string;
  performedBy: string;
  createdAt: string;
};

export type ProductSupplierLinkApi = {
  supplier_id: string;
  supplier_name: string;
  supplier_sku: string;
  is_primary: boolean;
  last_purchase_price: number;
};

export type ProductSupplierLink = {
  supplierId: string;
  supplierName: string;
  supplierSku: string;
  isPrimary: boolean;
  lastPurchasePrice: number;
};

export type ProductSupplierLinkDraft = {
  supplierId: string;
  supplierSku: string;
  isPrimary: boolean;
  lastPurchasePrice: string;
};

export type Supplier = LocationFieldsApi & {
  id: string;
  name: string;
  contact: string;
  address: string;
  notes?: string | null;
  created_at?: string | null;
};

export type SupplierDraft = {
  name: string;
  contact: string;
  address: string;
  locationDisplayName: string;
  locationStreet: string;
  locationHouseNumber: string;
  locationPostcode: string;
  locationCity: string;
  locationState: string;
  locationCountry: string;
  locationLat: string;
  locationLon: string;
  notes: string;
};

export type PurchaseOrderLineApi = {
  line_id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  received_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
};

export type PurchaseOrderApi = {
  id: string;
  order_number: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  ordered_at: string;
  received_at?: string | null;
  lines: PurchaseOrderLineApi[];
};

export type PurchaseOrderLine = {
  lineId: string;
  productId: string;
  productTitle: string;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitCost: number;
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  orderedAt: string;
  receivedAt?: string | null;
  lines: PurchaseOrderLine[];
};

export type PurchaseOrderDraftLine = {
  productId: string;
  quantity: string;
  unitCost: string;
};

export type PurchaseOrderReceiveDraft = {
  warehouseCode: string;
  lines: Record<string, string>;
};

export type SaleOrderLineApi = {
  line_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
};

export type AppliedDiscountApi = {
  description: string;
  amount: number;
};

export type SaleOrderApi = {
  order_id: string;
  order_number: string;
  warehouse_code: string;
  status: string;
  created_at: string;
  subtotal: number;
  discount_total: number;
  total: number;
  lines: SaleOrderLineApi[];
  discounts: AppliedDiscountApi[];
};

export type SaleOrderLine = {
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
};

export type AppliedDiscount = {
  description: string;
  amount: number;
};

export type SaleOrder = {
  orderId: string;
  orderNumber: string;
  warehouseCode: string;
  status: string;
  createdAt: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  lines: SaleOrderLine[];
  discounts: AppliedDiscount[];
};

export type SaleDraft = {
  warehouseCode: string;
  productId: string;
  quantity: string;
  customDiscountAmount: string;
  isFirstCustomer: boolean;
};

export type ReturnDraft = {
  salesOrderId: string;
  salesOrderLineId: string;
  quantity: string;
  reason: string;
};

export type ReturnResponse = {
  return_id: string;
  return_number: string;
  refund_total: number;
};

export type AppSettings = {
  lowStockThreshold: number;
  confirmDelete: boolean;
  autoRefresh: boolean;
  autoRefreshSeconds: number;
};

export type ActivityLog = {
  id: string;
  timestamp: string;
  performed_by: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: string | null;
  reason: string | null;
};

export type StaffUserSummary = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  avatar_image: string;
};
