// Core domain types used across the application
// These mirror the Pydantic schemas from the FastAPI backend

export type Book = {
  id: string;
  name: string;
  author: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  price?: number; // for backward compatibility
  quantity: number;
  sku: string;
  category: string;
  supplierId?: string;
  created_at?: string | null;
  updated_at?: string | null;
  notes?: string | null;
};

export type NewBookDraft = {
  name: string;
  author: string;
  description: string;
  purchasePrice: string;
  sellingPrice: string;
  quantity: string;
  sku: string;
  category: string;
  supplierId: string;
  notes: string;
};

export type EditBookDraft = NewBookDraft;

export type Supplier = {
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
  notes: string;
};

export type PurchaseOrder = {
  id: string;
  supplierId?: string;
  supplier: string;
  bookId: string;
  bookName: string;
  bookSku?: string;
  unitPrice?: number;
  quantity: number;
  deliveredQuantity: number;
  status: "offen" | "teilgeliefert" | "geliefert";
  createdAt: string;
  deliveredAt?: string;
};

export type PurchaseOrderApi = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  book_id: string;
  book_name: string;
  book_sku?: string;
  unit_price?: number;
  quantity: number;
  delivered_quantity: number;
  status: "offen" | "teilgeliefert" | "geliefert";
  created_at: string;
  delivered_at?: string | null;
};

export type IncomingDelivery = {
  id: string;
  orderId: string;
  supplierId: string;
  supplier: string;
  bookId: string;
  bookName: string;
  quantity: number;
  unitPrice: number;
  receivedAt: string;
};

export type IncomingDeliveryApi = {
  id: string;
  order_id: string;
  supplier_id: string;
  supplier_name: string;
  book_id: string;
  book_name: string;
  quantity: number;
  unit_price: number;
  received_at: string;
};

export type MovementApi = {
  id: string;
  book_id: string;
  book_name: string;
  quantity_change: number;
  movement_type: "IN" | "OUT" | "CORRECTION";
  reason?: string | null;
  timestamp?: string | null;
  performed_by?: string;
};

export type Movement = {
  id: string;
  book_id: string;
  book_name: string;
  quantity_change: number;
  movement_type: "IN" | "OUT" | "CORRECTION";
  reason?: string | null;
  timestamp: string;
  performed_by: string;
};

export type ReorderDraft = {
  bookId: string;
  supplierId: string;
  quantity: string;
  unitPrice: string;
};

export type SaleType = "Verkauf" | "Retoure";

export type SaleEntry = {
  id: string;
  bookId: string;
  bookName: string;
  type: SaleType;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  reason: string;
  discountAmount?: number;
};

export type BookApi = Book & {
  purchase_price?: number;
  sell_price?: number;
  supplier_id?: string;
};

export type AppSettings = {
  lowStockThreshold: number;
  confirmDelete: boolean;
  autoRefresh: boolean;
  autoRefreshSeconds: number;
  loadDemoData: boolean;
};

export type PageKey =
  | "dashboard"
  | "lager"
  | "katalog"
  | "bestellen"
  | "wareneingang"
  | "verkauf"
  | "lieferanten"
  | "reports"
  | "einstellungen"
  | "activity";

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

// Commerce v2 types
export type CatalogProduct = {
  id: string;
  sku: string;
  title: string;
  author: string;
  description: string;
  category: string;
  is_active: boolean;
};

export type StockEntry = {
  product_id: string;
  sku: string;
  title: string;
  author: string;
  on_hand: number;
  allocated: number;
  available: number;
  reorder_point: number;
  warehouse_code: string;
};

export type SaleOrderLine = {
  product_id: string;
  sku: string;
  title: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
};

export type SaleOrder = {
  id: string;
  order_number: string;
  cashier_user_id: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  total_discount: number;
  total_tax: number;
  final_amount: number;
  status: "draft" | "completed" | "cancelled" | "refunded";
  lines: SaleOrderLine[];
  created_at: string;
  completed_at: string | null;
};

export type DiscountRule = {
  id: string;
  name: string;
  rule_type: "percentage" | "fixed_amount" | "buy_x_get_y";
  value_type: "percentage" | "amount";
  value: number;
  min_order_amount: number;
  stackable: boolean;
  is_active: boolean;
};

export type PurchaseOrderV2 = {
  id: string;
  order_number: string;
  supplier_id: string;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  created_at: string;
  ordered_at: string | null;
  received_at: string | null;
};

export type PurchaseOrderLineV2 = {
  id: string;
  product_id: string;
  sku: string;
  title: string;
  quantity: number;
  unit_price: number;
  received_quantity: number;
  status: "pending" | "partially_received" | "received";
};
