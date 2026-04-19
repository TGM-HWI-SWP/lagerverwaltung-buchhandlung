import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Sun,
  Moon,
  Package,
  Truck,
  ShoppingBag,
  ShoppingCart,
  Building2,
  BarChart3,
  FileText,
  Settings as SettingsIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client";

type PageKey =
  | "dashboard"
  | "lager"
  | "bestellen"
  | "wareneingang"
  | "verkauf"
  | "lieferanten"
  | "reports"
  | "einstellungen";

type Book = {
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

type NewBookDraft = {
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

type EditBookDraft = NewBookDraft;

type AppSettings = {
  lowStockThreshold: number;
  confirmDelete: boolean;
  autoRefresh: boolean;
  autoRefreshSeconds: number;
};

type OrderStatus = "offen" | "teilgeliefert" | "geliefert";

type PurchaseOrder = {
  id: string;
  supplierId?: string;
  supplier: string;
  bookId: string;
  bookName: string;
  bookSku?: string;
  unitPrice?: number;
  quantity: number;
  deliveredQuantity: number;
  status: OrderStatus;
  createdAt: string;
  deliveredAt?: string;
};

type Supplier = {
  id: string;
  name: string;
  contact: string;
  address: string;
  notes?: string | null;
  created_at?: string | null;
};

type BookApi = Book & {
  purchase_price?: number;
  sell_price?: number;
  supplier_id?: string;
};

type SupplierDraft = {
  name: string;
  contact: string;
  address: string;
  notes: string;
};

type ReorderDraft = {
  bookId: string;
  supplierId: string;
  quantity: string;
  unitPrice: string;
};

type IncomingDelivery = {
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

type PurchaseOrderApi = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  book_id: string;
  book_name: string;
  book_sku?: string;
  unit_price?: number;
  quantity: number;
  delivered_quantity: number;
  status: OrderStatus;
  created_at: string;
  delivered_at?: string | null;
};

type IncomingDeliveryApi = {
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

const DEFAULT_SETTINGS: AppSettings = {
  lowStockThreshold: 5,
  confirmDelete: true,
  autoRefresh: false,
  autoRefreshSeconds: 30,
};

const SETTINGS_STORAGE_KEY = "bookmanager.settings";

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  lager: "Lager",
  bestellen: "Bestellen",
  wareneingang: "Wareneingang",
  verkauf: "Verkauf",
  lieferanten: "Lieferanten",
  reports: "Berichte",
  einstellungen: "Einstellungen",
};

const PAGE_DESCRIPTIONS: Record<PageKey, string> = {
  dashboard: "Kennzahlen, Umsatzentwicklung und aktueller Überblick.",
  lager: "Bücher, Bestände und Stammdaten zentral verwalten.",
  bestellen: "Erst- und Nachbestellungen sauber anlegen und verfolgen.",
  wareneingang: "Angekommene Lieferungen prüfen und ins Lager einbuchen.",
  verkauf: "Verkäufe und Retouren direkt aus dem Bestand buchen.",
  lieferanten: "Lieferantenbeziehungen und Kontaktdaten im Blick behalten.",
  reports: "Bestandsberichte exportieren und Entwicklungen auswerten.",
  einstellungen: "Schwellenwerte, Aktualisierung und Komfortfunktionen anpassen.",
};

type SaleType = "Verkauf" | "Retoure";

type SaleEntry = {
  id: string;
  bookId: string;
  bookName: string;
  type: SaleType;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  reason: string;
};

type MovementApi = {
  id: string;
  book_id: string;
  book_name: string;
  quantity_change: number;
  movement_type: "IN" | "OUT" | "CORRECTION";
  reason?: string | null;
  timestamp?: string | null;
  performed_by?: string;
};

type SaleDraft = {
  bookId: string;
  quantity: string;
  saleType: SaleType;
  unitPrice: string;
  reason: string;
};

type MobilePadField = "quantity" | "unitPrice";

function getDefaultSaleReason(saleType: SaleType, bookName?: string): string {
  if (!bookName) {
    return saleType === "Retoure" ? "Retoure" : "Verkauf";
  }
  return saleType === "Retoure" ? `Retoure von ${bookName}` : `Verkauf von ${bookName}`;
}

function appendToNumericValue(current: string, char: string, allowDecimal: boolean): string {
  if (char === ".") {
    if (!allowDecimal || current.includes(".")) {
      return current;
    }
    return current === "" ? "0." : `${current}.`;
  }

  if (!/^\d$/.test(char)) {
    return current;
  }

  if (allowDecimal) {
    const [whole, decimal = ""] = current.split(".");
    if (current.includes(".") && decimal.length >= 2) {
      return current;
    }
    if (whole === "0" && !current.includes(".")) {
      return char;
    }
    return `${current}${char}`;
  }

  if (current === "0") {
    return char;
  }
  return `${current}${char}`;
}

function parseSaleEntry(movement: MovementApi): SaleEntry | null {
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

function mapBookApiToBook(book: BookApi): Book {
  return {
    ...book,
    purchasePrice: book.purchase_price ?? book.purchasePrice ?? 0,
    sellingPrice: book.sell_price ?? book.sellingPrice ?? 0,
    supplierId: book.supplier_id ?? book.supplierId ?? "",
  };
}

function mapDraftToBookPayload(
  draft: NewBookDraft | EditBookDraft,
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

function mapPurchaseOrderApiToOrder(order: PurchaseOrderApi): PurchaseOrder {
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

function mapIncomingDeliveryApi(delivery: IncomingDeliveryApi): IncomingDelivery {
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

export default function Dashboard() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState<PageKey>("dashboard");
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_SETTINGS;
      }
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [movements, setMovements] = useState<MovementApi[]>([]);
  const [incomingDeliveries, setIncomingDeliveries] = useState<IncomingDelivery[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const toggleTheme = () => setDark((prev) => !prev);

  const reloadSuppliers = () => {
    apiGet<Supplier[]>("/suppliers")
      .then((data) => setSuppliers(data))
      .catch(() => setSuppliers([]));
  };

  const reloadBooks = () => {
    setLoadingBooks(true);
    setBookError(null);
    apiGet<BookApi[]>("/books")
      .then((data: BookApi[]) => setBooks(data.map(mapBookApiToBook)))
      .catch((err: Error) => setBookError(err.message))
      .finally(() => setLoadingBooks(false));
  };

  const reloadMovements = () => {
    apiGet<MovementApi[]>("/movements")
      .then((data) => setMovements(data))
      .catch(() => setMovements([]));
  };

  const reloadOrders = () => {
    apiGet<PurchaseOrderApi[]>("/purchase-orders")
      .then((data) => setOrders(data.map(mapPurchaseOrderApiToOrder)))
      .catch(() => setOrders([]));
  };

  const reloadIncomingDeliveries = () => {
    apiGet<IncomingDeliveryApi[]>("/incoming-deliveries")
      .then((data) => setIncomingDeliveries(data.map(mapIncomingDeliveryApi)))
      .catch(() => setIncomingDeliveries([]));
  };

  useEffect(() => {
    reloadBooks();
    reloadMovements();
    reloadOrders();
    reloadIncomingDeliveries();
  }, []);

  useEffect(() => {
    reloadSuppliers();
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!settings.autoRefresh) {
      return;
    }
    const intervalMs = Math.max(10, settings.autoRefreshSeconds) * 1000;
    const id = window.setInterval(() => {
      reloadBooks();
      reloadMovements();
      reloadOrders();
      reloadIncomingDeliveries();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [settings.autoRefresh, settings.autoRefreshSeconds]);

  const salesLog = useMemo(
    () =>
      movements
        .map(parseSaleEntry)
        .filter((entry): entry is SaleEntry => entry !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [movements],
  );

  const addBookToState = (book: Book) => {
    setBooks((prev) => [book, ...prev]);
  };

  const updateBookInState = (updatedBook: Book) => {
    setBooks((prev) => prev.map((book) => (book.id === updatedBook.id ? updatedBook : book)));
  };

  const stats = useMemo(() => {
    const totalBooks = books.length;
    const categories = new Set(books.map((b) => b.category).filter(Boolean)).size;
    const totalUnits = books.reduce((sum, b) => sum + b.quantity, 0);
    const totalValue = books.reduce((sum, b) => sum + (b.sellingPrice || b.price || 0) * b.quantity, 0);
    const totalRevenue = salesLog
      .filter((entry) => entry.type === "Verkauf")
      .reduce((sum, entry) => sum + entry.total, 0);
    return { totalBooks, categories, totalUnits, totalValue, totalRevenue };
  }, [books, salesLog]);

  const container = dark
    ? "min-h-screen bg-gray-950 text-white"
    : "min-h-screen bg-gray-100 text-gray-900";

  const sidebar = dark
    ? "w-64 min-h-screen shrink-0 bg-gray-900 text-white"
    : "w-64 min-h-screen shrink-0 border-r bg-white text-gray-900";

  const topbar = dark
    ? "flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 p-6"
    : "flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 p-6";

  const card = dark
    ? "border-gray-800 bg-gray-900 text-white shadow-sm shadow-black/20"
    : "border-gray-200 bg-white text-gray-900 shadow-sm shadow-gray-200/60";

  return (
    <div className={container}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <div className={sidebar}>
          <div className="p-6">
            <div className="text-xl font-bold">Buchhandlung</div>
            <div className={dark ? "mt-1 text-sm text-gray-400" : "mt-1 text-sm text-gray-500"}>
              Lager, Einkauf und Verkauf
            </div>
          </div>

          <nav className="flex flex-col gap-2 px-3">
            <MenuButton
              icon={<BarChart3 size={18} />}
              label="Dashboard"
              value="dashboard"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<Package size={18} />}
              label="Lager"
              value="lager"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<Truck size={18} />}
              label="Bestellen"
              value="bestellen"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<ShoppingBag size={18} />}
              label="Wareneingang"
              value="wareneingang"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<ShoppingCart size={18} />}
              label="Verkauf"
              value="verkauf"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<Building2 size={18} />}
              label="Lieferanten"
              value="lieferanten"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<FileText size={18} />}
              label="Berichte"
              value="reports"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<SettingsIcon size={18} />}
              label="Einstellungen"
              value="einstellungen"
              page={page}
              setPage={setPage}
              dark={dark}
            />
          </nav>
        </div>

        {/* Main Area */}
        <div className="flex-1 min-h-screen">
          {/* Topbar */}
          <div className={topbar}>
            <div>
              <h1 className="text-2xl font-semibold">{PAGE_TITLES[page]}</h1>
              <p className={dark ? "mt-1 text-sm text-gray-400" : "mt-1 text-sm text-gray-500"}>
                {PAGE_DESCRIPTIONS[page]}
              </p>
            </div>

            <Button variant="outline" onClick={toggleTheme} aria-label="Farbschema wechseln">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>

          <div className="mx-auto w-full max-w-7xl p-6">
            {page === "dashboard" && (
              <DashboardPage card={card} stats={stats} loading={loadingBooks} salesLog={salesLog} />
            )}
            {page === "lager" && (
              <InventoryPage
                card={card}
                books={books}
                setBooks={setBooks}
                loading={loadingBooks}
                error={bookError}
                dark={dark}
                settings={settings}
                updateBookInState={updateBookInState}
              />
            )}
            {page === "bestellen" && (
              <OrdersPage
                card={card}
                dark={dark}
                books={books}
                addBookToState={addBookToState}
                suppliers={suppliers}
                orders={orders}
                setOrders={setOrders}
                setIncomingDeliveries={setIncomingDeliveries}
                reloadOrders={reloadOrders}
                reloadIncomingDeliveries={reloadIncomingDeliveries}
              />
            )}
            {page === "wareneingang" && (
              <GoodsInPage
                card={card}
                dark={dark}
                books={books}
                incomingDeliveries={incomingDeliveries}
                setIncomingDeliveries={setIncomingDeliveries}
                reloadBooks={reloadBooks}
                reloadIncomingDeliveries={reloadIncomingDeliveries}
                reloadMovements={reloadMovements}
              />
            )}
            {page === "verkauf" && (
              <GoodsOutPage
                card={card}
                dark={dark}
                books={books}
                reloadBooks={reloadBooks}
                salesLog={salesLog}
                reloadMovements={reloadMovements}
              />
            )}
            {page === "reports" && (
              <ReportsPage
                card={card}
                dark={dark}
                onOpenDashboard={() => setPage("dashboard")}
              />
            )}
            {page === "lieferanten" && (
              <SuppliersPage
                card={card}
                dark={dark}
                suppliers={suppliers}
                reloadSuppliers={reloadSuppliers}
              />
            )}
            {page === "einstellungen" && (
              <SettingsPage card={card} dark={dark} settings={settings} setSettings={setSettings} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({
  card,
  stats,
  loading,
  salesLog,
}: {
  card: string;
  stats: {
    totalBooks: number;
    categories: number;
    totalUnits: number;
    totalValue: number;
    totalRevenue: number;
  };
  loading: boolean;
  salesLog: SaleEntry[];
}) {
  const revenueData = useMemo(() => {
    const monthlyRevenue: { [key: string]: number } = {};
    salesLog
      .filter((entry) => entry.type === "Verkauf")
      .forEach((entry) => {
        const date = new Date(entry.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + entry.total;
      });
    return Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [salesLog]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Bücher im Lager</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.totalBooks}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Kategorien</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.categories}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Bestand (Stück)</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.totalUnits}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Gesamtwert Lager</h2>
          <p className="mt-2 text-3xl">
            {loading ? "…" : `€${stats.totalValue.toFixed(2)}`}
          </p>
        </CardContent>
      </Card>
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Umsatz</h2>
          <p className="mt-2 text-3xl">€{stats.totalRevenue.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card className={`${card} md:col-span-5`}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Umsatzentwicklung</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`€${Number(value).toFixed(2)}`, 'Umsatz']} />
              <Bar dataKey="revenue" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryPage({
  card,
  books,
  setBooks,
  loading,
  error,
  dark,
  settings,
  updateBookInState,
}: {
  card: string;
  books: Book[];
  setBooks: Dispatch<SetStateAction<Book[]>>;
  loading: boolean;
  error: string | null;
  dark: boolean;
  settings: AppSettings;
  updateBookInState: (book: Book) => void;
}) {
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editDraft, setEditDraft] = useState<EditBookDraft>({
    name: "",
    author: "",
    description: "",
    purchasePrice: "",
    sellingPrice: "",
    quantity: "",
    sku: "",
    category: "",
    supplierId: "",
    notes: "",
  });

  const inputClass = dark
    ? "w-80 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-80 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const lowStockText = dark ? "text-amber-300" : "text-amber-700";
  const rowPaddingClass = "py-2";
  const modalInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const openEditModal = (book: Book) => {
    setEditingBookId(book.id);
    setEditDraft({
      name: book.name,
      author: book.author,
      description: book.description,
      purchasePrice: String(book.purchasePrice || book.price || 0),
      sellingPrice: String(book.sellingPrice || book.price || 0),
      quantity: String(book.quantity),
      sku: book.sku,
      category: book.category,
      supplierId: "",
      notes: book.notes ?? "",
    });
    setEditError(null);
    setDeleteConfirm(false);
    setEditOpen(true);
  };

  const onEditSave = async () => {
    if (!editingBookId) {
      return;
    }
    setEditing(true);
    setEditError(null);
    try {
      const updated = await apiPut<BookApi, Record<string, string | number | null>>(
        `/books/${editingBookId}`,
        mapDraftToBookPayload(editDraft, { id: editingBookId }),
      );
      updateBookInState(mapBookApiToBook(updated));
      setEditOpen(false);
      setEditingBookId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setEditError(message);
    } finally {
      setEditing(false);
    }
  };

  const onDelete = async () => {
    if (!editingBookId) {
      return;
    }
    setDeleting(true);
    setEditError(null);
    try {
      await apiDelete(`/books/${editingBookId}`);
      setBooks((prev) => prev.filter((book) => book.id !== editingBookId));
      setEditOpen(false);
      setEditingBookId(null);
      setDeleteConfirm(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Das Buch konnte nicht gelöscht werden.";
      setEditError(message);
    } finally {
      setDeleting(false);
    }
  };

  const startDeleteFlow = async () => {
    if (settings.confirmDelete) {
      setDeleteConfirm(true);
      return;
    }
    await onDelete();
  };

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return books;
    }
    return books.filter((book) => {
      return (
        book.name.toLowerCase().includes(query) ||
        book.sku.toLowerCase().includes(query) ||
        book.category.toLowerCase().includes(query)
      );
    });
  }, [books, search]);

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Bücherverwaltung</h2>

          <div className="mb-4 flex flex-wrap gap-3">
            <input
              placeholder="Suche nach Name, SKU oder Kategorie..."
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outline" onClick={() => setSearch("")}>Zurücksetzen</Button>
          </div>

          {editOpen && (
            <div className={`mb-6 rounded-xl border p-4 ${tableBorder}`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">Buch bearbeiten</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditOpen(false);
                    setDeleteConfirm(false);
                    setEditError(null);
                  }}
                >
                  Schließen
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  className={modalInputClass}
                  placeholder="Name *"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Autor"
                  value={editDraft.author}
                  onChange={(e) => setEditDraft((d) => ({ ...d, author: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Kategorie"
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="SKU (Auto-generiert)"
                  value={editDraft.sku}
                  onChange={(e) => setEditDraft((d) => ({ ...d, sku: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Einkaufspreis (EUR)"
                  inputMode="decimal"
                  value={editDraft.purchasePrice}
                  onChange={(e) => setEditDraft((d) => ({ ...d, purchasePrice: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Verkaufspreis (EUR)"
                  inputMode="decimal"
                  value={editDraft.sellingPrice}
                  onChange={(e) => setEditDraft((d) => ({ ...d, sellingPrice: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Bestand (Stück)"
                  inputMode="numeric"
                  value={editDraft.quantity}
                  onChange={(e) => setEditDraft((d) => ({ ...d, quantity: e.target.value }))}
                />
                <input
                  className={`${modalInputClass} md:col-span-2`}
                  placeholder="Beschreibung"
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                />
                <input
                  className={`${modalInputClass} md:col-span-2`}
                  placeholder="Notizen"
                  value={editDraft.notes}
                  onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button onClick={onEditSave} disabled={editing || editDraft.name.trim().length === 0}>
                  {editing ? "Speichere..." : "Änderungen speichern"}
                </Button>
                {!deleteConfirm ? (
                  <Button variant="destructive" onClick={startDeleteFlow}>
                    Löschen
                  </Button>
                ) : (
                  <>
                    <span className="text-sm text-red-400">Wirklich löschen?</span>
                    <Button variant="destructive" onClick={onDelete} disabled={deleting}>
                      {deleting ? "Lösche..." : "Ja, löschen"}
                    </Button>
                    <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                      Abbrechen
                    </Button>
                  </>
                )}
                {editError && <span className="text-sm text-red-400">{editError}</span>}
              </div>
            </div>
          )}

          {loading && <p className={`text-sm ${mutedText}`}>Lade Bücher…</p>}
          {error && (
            <p className="text-sm text-red-400">
              Fehler beim Laden der Bücher: {error}
            </p>
          )}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="mt-2 min-w-full text-left text-sm">
                <thead>
                  <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                    <th className="py-2">Buch</th>
                    <th>Kategorie</th>
                    <th>Beschreibung</th>
                    <th>Verkaufspreis</th>
                    <th>Bestand</th>
                    <th>Notiz</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBooks.length === 0 && (
                    <tr>
                      <td className={`py-4 ${mutedText}`} colSpan={6}>
                        Keine passenden Bücher vorhanden.
                      </td>
                    </tr>
                  )}
                  {filteredBooks.map((book) => (
                    <tr
                      key={book.id}
                      className={`border-b ${tableBorder} last:border-b-0`}
                    >
                      <td className={rowPaddingClass}>
                        <div className="font-medium">{book.name}</div>
                        {!!book.author && (
                          <div className={`text-xs ${mutedText}`}>{book.author}</div>
                        )}
                        <div className={`text-xs ${mutedText}`}>{book.sku || "ohne SKU"}</div>
                      </td>
                      <td>{book.category || "-"}</td>
                      <td className={rowPaddingClass}>{book.description || "-"}</td>
                      <td>
                        €{(book.sellingPrice || book.price || 0).toFixed(2)}
                      </td>
                      <td className={book.quantity <= settings.lowStockThreshold ? lowStockText : ""}>
                        <div className="flex items-center justify-between gap-3">
                          <span>{book.quantity}</span>
                          <Button size="sm" variant="outline" onClick={() => openEditModal(book)}>
                            Bearbeiten
                          </Button>
                        </div>
                      </td>
                      <td className={rowPaddingClass}>{book.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsPage({
  card,
  dark,
  onOpenDashboard,
}: {
  card: string;
  dark: boolean;
  onOpenDashboard: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const mutedText = dark ? "text-gray-400" : "text-gray-500";

  const downloadInventoryPdf = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const apiBase =
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";
      const response = await fetch(`${apiBase}/reports/inventory-pdf`);
      if (!response.ok) {
        throw new Error(`API-Fehler: ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "lagerbestand.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className={`${card} xl:col-span-2`}>
        <CardContent className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Lagerbestandsbericht</h2>
          <p className={`max-w-2xl text-sm ${mutedText}`}>
            Erzeugt einen PDF-Bericht mit der aktuellen Verteilung des Lagerbestands nach Kategorien.
          </p>
          <Button className="mt-4" onClick={downloadInventoryPdf} disabled={downloading}>
            {downloading ? "PDF wird erstellt…" : "PDF exportieren"}
          </Button>
          {downloadError && (
            <p className="mt-2 text-sm text-red-400">Fehler: {downloadError}</p>
          )}
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Bestandsentwicklung</h2>
          <p className={`text-sm ${mutedText}`}>
            Die wichtigsten Verläufe siehst du bereits im Dashboard. Weitere Berichte können hier ergänzt werden.
          </p>
          <Button className="mt-4" variant="outline" onClick={onOpenDashboard}>Zum Dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OrdersPage({
  card,
  dark,
  books,
  addBookToState,
  suppliers,
  orders,
  setOrders,
  setIncomingDeliveries,
  reloadOrders,
  reloadIncomingDeliveries,
}: {
  card: string;
  dark: boolean;
  books: Book[];
  addBookToState: (book: Book) => void;
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  setOrders: Dispatch<SetStateAction<PurchaseOrder[]>>;
  setIncomingDeliveries: Dispatch<SetStateAction<IncomingDelivery[]>>;
  reloadOrders: () => void;
  reloadIncomingDeliveries: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingBook, setCreatingBook] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [bookDraft, setBookDraft] = useState<NewBookDraft>({
    name: "",
    author: "",
    description: "",
    purchasePrice: "",
    sellingPrice: "",
    quantity: "",
    sku: "",
    category: "",
    supplierId: "",
    notes: "",
  });
  const [draft, setDraft] = useState<ReorderDraft>({
    bookId: "",
    supplierId: "",
    quantity: "1",
    unitPrice: "",
  });
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const formInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const selectedBook = useMemo(
    () => books.find((entry) => entry.id === draft.bookId) ?? null,
    [books, draft.bookId],
  );

  const openOrders = useMemo(
    () => orders.filter((order) => order.status !== "geliefert"),
    [orders],
  );

  useEffect(() => {
    if (!selectedBook) {
      return;
    }
    setDraft((prev) => ({
      ...prev,
      supplierId: prev.supplierId || selectedBook.supplierId || suppliers[0]?.id || "",
      unitPrice: prev.unitPrice || String(selectedBook.purchasePrice || 0),
    }));
  }, [selectedBook, suppliers]);

  const onCreateBook = async () => {
    setBookError(null);
    setCreatingBook(true);
    try {
      const initialOrderQuantity = Math.max(0, Number(bookDraft.quantity) || 0);
      const supplierId = bookDraft.supplierId.trim() || suppliers[0]?.id || "";
      if (initialOrderQuantity > 0 && supplierId === "") {
        setBookError("Für eine Erstbestellung braucht das Buch einen Lieferanten.");
        return;
      }
      const createdBook = await apiPost<BookApi, Record<string, string | number | null>>(
        "/books",
        {
          ...mapDraftToBookPayload(bookDraft),
          quantity: 0,
        },
      );
      const mappedBook = mapBookApiToBook(createdBook);
      addBookToState(mappedBook);
      if (initialOrderQuantity > 0) {
        const createdOrder = await apiPost<PurchaseOrderApi, Record<string, string | number>>(
          "/purchase-orders",
          {
            supplier_id: mappedBook.supplierId || supplierId,
            book_id: mappedBook.id,
            book_name: mappedBook.name,
            book_sku: mappedBook.sku,
            unit_price: mappedBook.purchasePrice,
            quantity: initialOrderQuantity,
          },
        );
        setOrders((prev) => [mapPurchaseOrderApiToOrder(createdOrder), ...prev]);
      }
      setBookDraft({
        name: "",
        author: "",
        description: "",
        purchasePrice: "",
        sellingPrice: "",
        quantity: "",
        sku: "",
        category: "",
        supplierId: "",
        notes: "",
      });
      setCreateOpen(false);
    } catch (err) {
      setBookError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setCreatingBook(false);
    }
  };

  const createReorder = async () => {
    setOrderError(null);
    setCreatingOrder(true);
    try {
      if (!selectedBook) {
        setOrderError("Bitte ein Buch aus dem Lager auswählen.");
        return;
      }
      const quantity = Number(draft.quantity);
      const unitPrice = Number(draft.unitPrice);
      const selectedSupplier =
        suppliers.find((supplier) => supplier.id === draft.supplierId) ?? null;

      if (!selectedSupplier) {
        setOrderError("Bitte einen Lieferanten auswählen.");
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setOrderError("Bitte eine gültige Nachbestellmenge > 0 eingeben.");
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setOrderError("Bitte einen gültigen Einkaufspreis >= 0 eingeben.");
        return;
      }

      const createdOrder = await apiPost<PurchaseOrderApi, Record<string, string | number>>(
        "/purchase-orders",
        {
          supplier_id: selectedSupplier.id,
          book_id: selectedBook.id,
          book_name: selectedBook.name,
          book_sku: selectedBook.sku,
          unit_price: unitPrice,
          quantity: Math.round(quantity),
        },
      );

      setOrders((prev) => [mapPurchaseOrderApiToOrder(createdOrder), ...prev]);
      setDraft({
        bookId: "",
        supplierId: "",
        quantity: "1",
        unitPrice: "",
      });
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setCreatingOrder(false);
    }
  };

  const receiveOrder = async (orderId: string) => {
    setOrderError(null);
    const order = orders.find((entry) => entry.id === orderId);
    if (!order || !order.supplierId) {
      return;
    }

    const remainingQuantity = order.quantity - order.deliveredQuantity;
    const receivedQuantity = Number(receivedDrafts[orderId] || remainingQuantity);
    if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) {
      setOrderError("Bitte eine gültige Liefermenge > 0 eingeben.");
      return;
    }
    if (receivedQuantity > remainingQuantity) {
      setOrderError("Die Teil-Lieferung darf nicht größer als die offene Restmenge sein.");
      return;
    }

    try {
      const createdDelivery = await apiPost<IncomingDeliveryApi, { quantity: number }>(
        `/purchase-orders/${orderId}/receive`,
        { quantity: Math.round(receivedQuantity) },
      );
      setIncomingDeliveries((prev) => [mapIncomingDeliveryApi(createdDelivery), ...prev]);
      reloadOrders();
      reloadIncomingDeliveries();
      setReceivedDrafts((prev) => ({ ...prev, [orderId]: "" }));
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Bestellen</h2>
          <div className={`grid grid-cols-1 gap-3 rounded-xl border p-4 ${tableBorder} md:grid-cols-2`}>
            <button
              type="button"
              onClick={() => setCreateOpen((v) => !v)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                createOpen
                  ? dark
                    ? "border-blue-500/70 bg-blue-500/10"
                    : "border-blue-400 bg-blue-50"
                  : dark
                    ? "border-gray-700 bg-gray-950 hover:border-blue-500/50 hover:bg-blue-500/5"
                    : "border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <div className="mb-1 text-sm font-semibold">Erstbestellung anlegen</div>
              <p className={`text-sm ${mutedText}`}>
                Neue Titel mit erster Bestellung anlegen.
              </p>
            </button>
            <div className={`rounded-xl border p-4 ${dark ? "border-gray-700 bg-gray-950" : "border-gray-300 bg-white"}`}>
              <div className="mb-1 text-sm font-semibold">Nachbestellung anlegen</div>
              <p className={`mb-3 text-sm ${mutedText}`}>
                Bestehende Bücher neu bestellen und offen verfolgen.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className={formInputClass}
                  value={draft.bookId}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      bookId: e.target.value,
                      supplierId: "",
                      unitPrice: "",
                    }))
                  }
                >
                  <option value="">Buch aus Lager auswählen</option>
                  {books
                    .slice()
                    .sort((a, b) => (a.quantity - b.quantity) || a.name.localeCompare(b.name))
                    .map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.name} ({book.quantity} Stk.)
                      </option>
                    ))}
                </select>
                <select
                  className={formInputClass}
                  value={draft.supplierId}
                  onChange={(e) => setDraft((prev) => ({ ...prev, supplierId: e.target.value }))}
                >
                  <option value="">Lieferant auswählen</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <input
                  className={formInputClass}
                  type="number"
                  min={1}
                  placeholder="Menge"
                  value={draft.quantity}
                  onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                />
                <input
                  className={formInputClass}
                  inputMode="decimal"
                  placeholder="Einkaufspreis"
                  value={draft.unitPrice}
                  onChange={(e) => setDraft((prev) => ({ ...prev, unitPrice: e.target.value }))}
                />
                <div className="md:col-span-2">
                  <Button
                    onClick={createReorder}
                    disabled={creatingOrder || books.length === 0 || suppliers.length === 0}
                  >
                    {creatingOrder ? "Erfasse Bestellung..." : "Nachbestellung anlegen"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {createOpen && (
            <div className={`rounded-xl border p-4 ${tableBorder}`}>
              <h3 className="mb-1 text-base font-semibold">Erstbestellung anlegen</h3>
              <p className={`mb-4 text-sm ${mutedText}`}>
                Lege einen neuen Titel an. Die Erstmenge landet als offene Bestellung und wird später im Wareneingang eingebucht.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className={formInputClass} placeholder="Name *" value={bookDraft.name} onChange={(e) => setBookDraft((prev) => ({ ...prev, name: e.target.value }))} />
                <input className={formInputClass} placeholder="Autor" value={bookDraft.author} onChange={(e) => setBookDraft((prev) => ({ ...prev, author: e.target.value }))} />
                <input className={formInputClass} placeholder="Kategorie" value={bookDraft.category} onChange={(e) => setBookDraft((prev) => ({ ...prev, category: e.target.value }))} />
                <input className={formInputClass} placeholder="SKU (Auto-generiert)" value={bookDraft.sku} onChange={(e) => setBookDraft((prev) => ({ ...prev, sku: e.target.value }))} />
                <input className={formInputClass} placeholder="Einkaufspreis" inputMode="decimal" value={bookDraft.purchasePrice} onChange={(e) => setBookDraft((prev) => ({ ...prev, purchasePrice: e.target.value }))} />
                <input className={formInputClass} placeholder="Verkaufspreis" inputMode="decimal" value={bookDraft.sellingPrice} onChange={(e) => setBookDraft((prev) => ({ ...prev, sellingPrice: e.target.value }))} />
                <input className={formInputClass} placeholder="Erstbestellmenge" inputMode="numeric" value={bookDraft.quantity} onChange={(e) => setBookDraft((prev) => ({ ...prev, quantity: e.target.value }))} />
                <select className={formInputClass} value={bookDraft.supplierId} onChange={(e) => setBookDraft((prev) => ({ ...prev, supplierId: e.target.value }))}>
                  <option value="">Lieferant auswählen</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
                <input className={`${formInputClass} md:col-span-2`} placeholder="Beschreibung" value={bookDraft.description} onChange={(e) => setBookDraft((prev) => ({ ...prev, description: e.target.value }))} />
                <input className={`${formInputClass} md:col-span-2`} placeholder="Notizen" value={bookDraft.notes} onChange={(e) => setBookDraft((prev) => ({ ...prev, notes: e.target.value }))} />
              </div>
              <div className="mt-4">
                <Button onClick={onCreateBook} disabled={creatingBook || bookDraft.name.trim() === ""}>
                  {creatingBook ? "Speichere..." : "Erstbestellung speichern"}
                </Button>
                {bookError ? <span className="ml-3 text-sm text-red-400">{bookError}</span> : null}
              </div>
            </div>
          )}

          {orderError ? <p className="text-sm text-red-400">{orderError}</p> : null}

          <div className={`rounded-xl border p-4 ${tableBorder}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Offene Bestellungen</h3>
              <span className={`text-sm ${mutedText}`}>{openOrders.length} offen</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                    <th className="py-2">Lieferant</th>
                    <th>Buch</th>
                    <th>Bestellt</th>
                    <th>Offen</th>
                    <th>Preis</th>
                    <th>Lieferung</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.length === 0 && (
                    <tr>
                      <td className={`py-4 ${mutedText}`} colSpan={6}>
                        Aktuell keine offenen Bestellungen.
                      </td>
                    </tr>
                  )}
                  {openOrders.map((order) => {
                    const remainingQuantity = order.quantity - order.deliveredQuantity;
                    return (
                      <tr key={order.id} className={`border-b ${tableBorder} last:border-b-0`}>
                        <td className="py-2">{order.supplier}</td>
                        <td>
                          <div>{order.bookName}</div>
                          <div className={`text-xs ${mutedText}`}>{order.status}</div>
                        </td>
                        <td>{order.quantity}</td>
                        <td>{remainingQuantity}</td>
                        <td>{order.unitPrice != null ? `${order.unitPrice.toFixed(2)} EUR` : "-"}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <input
                              className={`${formInputClass} h-9 w-24`}
                              type="number"
                              min={1}
                              max={remainingQuantity}
                              placeholder={String(remainingQuantity)}
                              value={receivedDrafts[order.id] ?? ""}
                              onChange={(e) =>
                                setReceivedDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))
                              }
                            />
                            <Button size="sm" onClick={() => receiveOrder(order.id)}>
                              Als angekommen markieren
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GoodsInPage({
  card,
  dark,
  books,
  incomingDeliveries,
  setIncomingDeliveries,
  reloadBooks,
  reloadIncomingDeliveries,
  reloadMovements,
}: {
  card: string;
  dark: boolean;
  books: Book[];
  incomingDeliveries: IncomingDelivery[];
  setIncomingDeliveries: Dispatch<SetStateAction<IncomingDelivery[]>>;
  reloadBooks: () => void;
  reloadIncomingDeliveries: () => void;
  reloadMovements: () => void;
}) {
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const [bookingError, setBookingError] = useState<string | null>(null);

  const bookIncomingDelivery = async (deliveryId: string) => {
    setBookingError(null);
    const delivery = incomingDeliveries.find((entry) => entry.id === deliveryId);
    if (!delivery) {
      return;
    }
    try {
      const book = books.find((entry) => entry.id === delivery.bookId);
      if (!book) {
        setBookingError("Das zugehörige Buch wurde nicht gefunden.");
        return;
      }
      await apiPost(`/incoming-deliveries/${deliveryId}/book`, {
        performed_by: "ui",
      });
      setIncomingDeliveries((prev) => prev.filter((entry) => entry.id !== deliveryId));
      reloadBooks();
      reloadIncomingDeliveries();
      reloadMovements();
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Wareneingang</h2>
          <p className={`text-sm ${mutedText}`}>
            Hier landen nur Lieferungen, die bereits angekommen sind und noch ins Lager eingebucht werden müssen.
          </p>
          {bookingError ? <p className="text-sm text-red-400">{bookingError}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                  <th className="py-2">Lieferant</th>
                  <th>Buch</th>
                  <th>Menge</th>
                  <th>Preis</th>
                  <th>Ankunft</th>
                  <th className="text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {incomingDeliveries.length === 0 && (
                  <tr>
                    <td className={`py-4 ${mutedText}`} colSpan={6}>
                      Aktuell warten keine Lieferungen auf Einbuchung.
                    </td>
                  </tr>
                )}
                {incomingDeliveries.map((delivery) => (
                  <tr key={delivery.id} className={`border-b ${tableBorder} last:border-b-0`}>
                    <td className="py-2">{delivery.supplier}</td>
                    <td>{delivery.bookName}</td>
                    <td>{delivery.quantity}</td>
                    <td>{delivery.unitPrice.toFixed(2)} EUR</td>
                    <td>{new Date(delivery.receivedAt).toLocaleString("de-AT")}</td>
                    <td className="text-right">
                      <Button size="sm" onClick={() => bookIncomingDelivery(delivery.id)}>
                        Einbuchen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GoodsOutPage({
  card,
  dark,
  books,
  reloadBooks,
  salesLog,
  reloadMovements,
}: {
  card: string;
  dark: boolean;
  books: Book[];
  reloadBooks: () => void;
  salesLog: SaleEntry[];
  reloadMovements: () => void;
}) {
  const [draft, setDraft] = useState<SaleDraft>({
    bookId: "",
    quantity: "1",
    saleType: "Verkauf",
    unitPrice: "",
    reason: "",
  });
  const [mobileMode, setMobileMode] = useState(false);
  const [mobilePadField, setMobilePadField] = useState<MobilePadField>("quantity");
  const [selling, setSelling] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleSuccess, setSaleSuccess] = useState<string | null>(null);
  const formInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";
  const mobileInputClass = dark
    ? "w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-base text-white placeholder:text-gray-400"
    : "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const selectedBook = useMemo(() => books.find((book) => book.id === draft.bookId) ?? null, [books, draft.bookId]);
  const mobileShellClass = dark ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-900";
  const mobilePanelClass = dark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white";
  const mobileFieldActiveClass = dark
    ? "border-blue-500 bg-blue-500/10"
    : "border-blue-500 bg-blue-50";
  const mobileFieldIdleClass = dark
    ? "border-gray-700 bg-gray-950"
    : "border-gray-300 bg-white";
  const keypadButtonClass = dark
    ? "rounded-2xl border border-gray-700 bg-gray-950 px-4 py-4 text-2xl font-semibold text-white active:bg-blue-500/20"
    : "rounded-2xl border border-gray-300 bg-white px-4 py-4 text-2xl font-semibold text-gray-900 active:bg-blue-100";

  useEffect(() => {
    if (selectedBook) {
      setDraft((prev) => ({
        ...prev,
        unitPrice:
          prev.unitPrice ||
          String(prev.saleType === "Retoure" ? selectedBook.sellingPrice || selectedBook.price || 0 : selectedBook.sellingPrice || selectedBook.price || 0),
      }));
    } else {
      setDraft((prev) => ({ ...prev, unitPrice: "" }));
    }
  }, [selectedBook]);

  useEffect(() => {
    const defaultReason = getDefaultSaleReason(draft.saleType, selectedBook?.name);
    setDraft((prev) => {
      if (
        prev.reason.trim() === "" ||
        prev.reason === getDefaultSaleReason("Verkauf", selectedBook?.name) ||
        prev.reason === getDefaultSaleReason("Retoure", selectedBook?.name) ||
        prev.reason.startsWith("Verkauf von ") ||
        prev.reason.startsWith("Retoure von ")
      ) {
        return { ...prev, reason: defaultReason };
      }
      return prev;
    });
  }, [draft.saleType, selectedBook?.name]);

  const startReturnForSale = (sale: SaleEntry) => {
    setDraft({
      bookId: sale.bookId,
      quantity: String(sale.quantity),
      saleType: "Retoure",
      unitPrice: String(sale.unitPrice),
      reason: `Retoure zu Verkauf ${sale.id}`,
    });
    setSaleError(null);
    setSaleSuccess(null);
    setMobilePadField("quantity");
  };

  const setMobileFieldValue = (field: MobilePadField, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleMobilePadInput = (char: string) => {
    const allowDecimal = mobilePadField === "unitPrice";
    const currentValue = draft[mobilePadField];
    const nextValue = appendToNumericValue(currentValue, char, allowDecimal);
    setMobileFieldValue(mobilePadField, nextValue);
  };

  const handleMobileBackspace = () => {
    const currentValue = draft[mobilePadField];
    setMobileFieldValue(mobilePadField, currentValue.slice(0, -1));
  };

  const handleMobileClear = () => {
    setMobileFieldValue(mobilePadField, "");
  };

  const onSell = async () => {
    const qty = Number(draft.quantity);
    const price = Number(draft.unitPrice);
    setSaleError(null);
    setSaleSuccess(null);
    if (!selectedBook) {
      setSaleError("Bitte ein Buch auswählen.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setSaleError("Bitte eine gültige Menge > 0 eingeben.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setSaleError("Bitte einen gültigen Verkaufspreis >= 0 eingeben.");
      return;
    }
    if (draft.reason.trim().length === 0) {
      setSaleError("Bitte einen Grund eingeben.");
      return;
    }
    setSelling(true);
    try {
      const reasonPrefix = draft.saleType === "Retoure" ? "Retoure" : "Verkauf";
      await apiPost("/movements", {
        book_id: selectedBook.id,
        book_name: selectedBook.name,
        quantity_change: Math.round(qty),
        movement_type: draft.saleType === "Retoure" ? "IN" : "OUT",
        reason: `${reasonPrefix}: ${draft.reason.trim()} [price=${price.toFixed(2)}]`,
        performed_by: "ui",
      });
      setSaleSuccess(
        `${Math.round(qty)} Stk. von "${selectedBook.name}" als ${draft.saleType.toLowerCase()} gebucht.`
      );
      setDraft({
        bookId: "",
        quantity: "1",
        saleType: "Verkauf",
        unitPrice: "",
        reason: "",
      });
      setMobilePadField("quantity");
      reloadBooks();
      reloadMovements();
    } catch (err) {
      setSaleError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSelling(false);
    }
  };

  if (mobileMode) {
    return (
      <div className={`fixed inset-0 z-40 overflow-y-auto ${mobileShellClass}`}>
        <div className="flex min-h-screen flex-col">
          <div className={`sticky top-0 z-10 border-b px-4 py-4 ${mobilePanelClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Verkauf Mobile</h2>
                <p className={`text-sm ${mutedText}`}>Tablet-Ansicht für den schnellen Verkauf an der Kasse</p>
              </div>
              <Button variant="outline" onClick={() => setMobileMode(false)}>
                Schließen
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className={`rounded-3xl border p-4 ${mobilePanelClass}`}>
              <div className="grid grid-cols-1 gap-3">
                <select
                  className={mobileInputClass}
                  value={draft.bookId}
                  onChange={(e) => {
                    setDraft((prev) => ({ ...prev, bookId: e.target.value, unitPrice: "" }));
                    setMobilePadField("quantity");
                  }}
                >
                  <option value="">Buch aus dem Lager wählen</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name} ({book.quantity} Stk.)
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={`${mobileInputClass} ${draft.saleType === "Verkauf" ? mobileFieldActiveClass : ""}`}
                    onClick={() => setDraft((prev) => ({ ...prev, saleType: "Verkauf" }))}
                  >
                    Verkauf
                  </button>
                  <button
                    type="button"
                    className={`${mobileInputClass} ${draft.saleType === "Retoure" ? mobileFieldActiveClass : ""}`}
                    onClick={() => setDraft((prev) => ({ ...prev, saleType: "Retoure" }))}
                  >
                    Retoure
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMobilePadField("quantity")}
                className={`rounded-3xl border p-4 text-left ${mobilePadField === "quantity" ? mobileFieldActiveClass : mobileFieldIdleClass}`}
              >
                <div className={`text-sm ${mutedText}`}>Stück</div>
                <div className="mt-2 text-4xl font-semibold">{draft.quantity || "0"}</div>
              </button>
              <button
                type="button"
                onClick={() => setMobilePadField("unitPrice")}
                className={`rounded-3xl border p-4 text-left ${mobilePadField === "unitPrice" ? mobileFieldActiveClass : mobileFieldIdleClass}`}
              >
                <div className={`text-sm ${mutedText}`}>Preis / Stk.</div>
                <div className="mt-2 text-4xl font-semibold">{draft.unitPrice || "0.00"}</div>
              </button>
            </div>

            <div className={`rounded-3xl border p-4 ${mobilePanelClass}`}>
              <textarea
                className={`${mobileInputClass} min-h-24 resize-none`}
                placeholder={draft.saleType === "Retoure" ? "Retourengrund" : "Verkaufsgrund"}
                value={draft.reason}
                onChange={(e) => setDraft((prev) => ({ ...prev, reason: e.target.value }))}
              />
              {saleError ? <p className="mt-3 text-sm text-red-400">{saleError}</p> : null}
              {saleSuccess ? <p className="mt-3 text-sm text-emerald-400">{saleSuccess}</p> : null}
            </div>

            <div className={`rounded-3xl border p-4 ${mobilePanelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium">
                  Zahlenblock: {mobilePadField === "quantity" ? "Stück" : "Preis"}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleMobileClear}>
                    C
                  </Button>
                  <Button variant="outline" onClick={handleMobileBackspace}>
                    ←
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "00"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={keypadButtonClass}
                    onClick={() => {
                      if (key === "00") {
                        handleMobilePadInput("0");
                        handleMobilePadInput("0");
                        return;
                      }
                      handleMobilePadInput(key);
                    }}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className={`rounded-3xl border p-4 ${mobilePanelClass}`}>
              <h3 className="mb-3 text-base font-semibold">Letzte Vorgänge</h3>
              <div className="space-y-3">
                {salesLog.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border p-4 ${dark ? "border-gray-700 bg-gray-950" : "border-gray-200 bg-gray-50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{entry.bookName}</div>
                        <div className={`text-sm ${mutedText}`}>{entry.reason}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{entry.quantity} Stk.</div>
                        <div className={`text-sm ${entry.total < 0 ? "text-amber-400" : ""}`}>{entry.total.toFixed(2)} EUR</div>
                      </div>
                    </div>
                    {entry.type === "Verkauf" ? (
                      <Button className="mt-3 h-11 w-full rounded-xl" variant="outline" onClick={() => startReturnForSale(entry)}>
                        Retournieren
                      </Button>
                    ) : null}
                  </div>
                ))}
                {salesLog.length === 0 ? <p className={`text-sm ${mutedText}`}>Noch keine Verkäufe oder Retouren gebucht.</p> : null}
              </div>
            </div>
          </div>

          <div className={`sticky bottom-0 border-t p-4 ${mobilePanelClass}`}>
            <Button onClick={onSell} disabled={selling} className="h-16 w-full rounded-2xl text-lg">
              {selling ? "Buche Vorgang..." : draft.saleType === "Retoure" ? "Retoure buchen" : "Verkauf buchen"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Verkauf</h2>
            <Button variant="outline" onClick={() => setMobileMode((prev) => !prev)}>
              {mobileMode ? "Standardansicht" : "Kassenansicht"}
            </Button>
          </div>
          <div className={mobileMode ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-3 md:grid-cols-2"}>
            <select
              className={mobileMode ? mobileInputClass : formInputClass}
              value={draft.bookId}
              onChange={(e) => setDraft((prev) => ({ ...prev, bookId: e.target.value, unitPrice: "" }))}
            >
              <option value="">Buch aus dem Lager wählen</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name} ({book.quantity} Stk.)
                </option>
              ))}
            </select>
            <input
              className={mobileMode ? mobileInputClass : formInputClass}
              type="number"
              min={1}
              placeholder="Menge"
              value={draft.quantity}
              onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
            />
            <div className={mobileMode ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-3 md:grid-cols-2"}>
              <select
                className={mobileMode ? mobileInputClass : formInputClass}
                value={draft.saleType}
                onChange={(e) => setDraft((prev) => ({ ...prev, saleType: e.target.value as SaleType }))}
              >
                <option value="Verkauf">Verkauf</option>
                <option value="Retoure">Retoure</option>
              </select>
              <input
                className={mobileMode ? mobileInputClass : formInputClass}
                placeholder="Preis pro Stück (EUR)"
                inputMode="decimal"
                value={draft.unitPrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, unitPrice: e.target.value }))}
              />
            </div>
          </div>
          <input
            className={mobileMode ? mobileInputClass : formInputClass}
            placeholder={draft.saleType === "Retoure" ? "Retourengrund" : "Verkaufsgrund"}
            value={draft.reason}
            onChange={(e) => setDraft((prev) => ({ ...prev, reason: e.target.value }))}
          />
          <div className={mobileMode ? "sticky bottom-4 z-10" : ""}>
            <Button
              onClick={onSell}
              disabled={selling}
              className={mobileMode ? "h-14 w-full rounded-xl text-base" : ""}
            >
              {selling ? "Buche Vorgang..." : draft.saleType === "Retoure" ? "Retoure buchen" : "Verkauf buchen"}
            </Button>
            {saleError ? <span className="ml-3 text-sm text-red-400">{saleError}</span> : null}
            {saleSuccess ? <span className="ml-3 text-sm text-emerald-400">{saleSuccess}</span> : null}
          </div>
          <div className={`rounded-xl border p-4 ${tableBorder}`}>
            <h3 className="mb-3 text-base font-semibold">Verkaufsverlauf und Retouren</h3>
            {salesLog.length === 0 ? (
              <p className={`py-4 text-sm ${mutedText}`}>Noch keine Verkäufe oder Retouren gebucht.</p>
            ) : mobileMode ? (
              <div className="space-y-3">
                {salesLog.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-xl border p-4 ${dark ? "border-gray-700 bg-gray-950" : "border-gray-200 bg-gray-50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{entry.bookName}</div>
                        <div className={`text-sm ${mutedText}`}>{new Date(entry.createdAt).toLocaleString("de-AT")}</div>
                      </div>
                      <span className={`rounded-md px-2 py-1 text-xs ${entry.type === "Retoure" ? "bg-amber-700/30 text-amber-300" : "bg-emerald-700/30 text-emerald-300"}`}>
                        {entry.type}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>Menge: {entry.quantity}</div>
                      <div>Preis: {entry.unitPrice.toFixed(2)} EUR</div>
                      <div className="col-span-2">Grund: {entry.reason}</div>
                      <div className={entry.total < 0 ? "text-amber-400" : ""}>Gesamt: {entry.total.toFixed(2)} EUR</div>
                    </div>
                    <div className="mt-3">
                      {entry.type === "Verkauf" ? (
                        <Button className="h-11 w-full rounded-xl" variant="outline" onClick={() => startReturnForSale(entry)}>
                          Retournieren
                        </Button>
                      ) : (
                        <span className={`text-xs ${mutedText}`}>Bereits Retoure</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                      <th className="py-2">Datum</th>
                      <th>Buch</th>
                      <th>Art</th>
                      <th>Grund</th>
                      <th>Menge</th>
                      <th>Preis/Stk.</th>
                      <th>Gesamt</th>
                      <th className="text-right">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesLog.map((entry) => (
                      <tr key={entry.id} className={`border-b ${tableBorder} last:border-b-0`}>
                        <td className="py-2">{new Date(entry.createdAt).toLocaleString("de-AT")}</td>
                        <td>{entry.bookName}</td>
                        <td>{entry.type}</td>
                        <td>{entry.reason}</td>
                        <td>{entry.quantity}</td>
                        <td>{entry.unitPrice.toFixed(2)} EUR</td>
                        <td className={entry.total < 0 ? "text-amber-400" : ""}>{entry.total.toFixed(2)} EUR</td>
                        <td className="text-right">
                          {entry.type === "Verkauf" ? (
                            <Button size="sm" variant="outline" onClick={() => startReturnForSale(entry)}>
                              Retournieren
                            </Button>
                          ) : (
                            <span className={`text-xs ${mutedText}`}>Bereits Retoure</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SuppliersPage({
  card,
  dark,
  suppliers,
  reloadSuppliers,
}: {
  card: string;
  dark: boolean;
  suppliers: Supplier[];
  reloadSuppliers: () => void;
}) {
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const formInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";
  const [creating, setCreating] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>({
    name: "",
    contact: "",
    address: "",
    notes: "",
  });

  const createSupplier = async () => {
    setSupplierError(null);
    setCreating(true);
    try {
      await apiPost<Supplier, Record<string, string | null>>("/suppliers", {
        id: "",
        name: draft.name.trim(),
        contact: draft.contact.trim(),
        address: draft.address.trim(),
        notes: draft.notes.trim() || null,
        created_at: null,
      });
      setDraft({
        name: "",
        contact: "",
        address: "",
        notes: "",
      });
      reloadSuppliers();
    } catch (err) {
      setSupplierError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Lieferanten</h2>
          <div className={`grid grid-cols-1 gap-3 rounded-xl border p-4 ${tableBorder} md:grid-cols-2`}>
            <input
              className={formInputClass}
              placeholder="Name *"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className={formInputClass}
              placeholder="Kontakt"
              value={draft.contact}
              onChange={(e) => setDraft((prev) => ({ ...prev, contact: e.target.value }))}
            />
            <input
              className={formInputClass}
              placeholder="Adresse"
              value={draft.address}
              onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
            />
            <input
              className={formInputClass}
              placeholder="Notizen"
              value={draft.notes}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            />
            <div className="md:col-span-2">
              <Button onClick={createSupplier} disabled={creating || draft.name.trim() === ""}>
                {creating ? "Lieferant wird gespeichert…" : "Lieferant anlegen"}
              </Button>
              {supplierError ? <span className="ml-3 text-sm text-red-400">{supplierError}</span> : null}
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${tableBorder}`}>
            <h3 className="mb-3 text-base font-semibold">Alle Lieferanten</h3>
            {suppliers.length === 0 ? (
              <p className={`text-sm ${mutedText}`}>Noch keine Lieferanten vorhanden.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className={`rounded-xl border p-4 ${dark ? "border-gray-700 bg-gray-950" : "border-gray-200 bg-gray-50"}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <h4 className="font-semibold">{supplier.name}</h4>
                      <span className={`text-xs ${mutedText}`}>{supplier.id}</span>
                    </div>
                    <p className="text-sm">{supplier.contact || "Kein Kontakt hinterlegt"}</p>
                    <p className={`mt-1 text-sm ${mutedText}`}>{supplier.address || "Keine Adresse hinterlegt"}</p>
                    <p className={`mt-3 text-sm ${mutedText}`}>{supplier.notes || "Keine Notizen"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPage({
  card,
  dark,
  settings,
  setSettings,
}: {
  card: string;
  dark: boolean;
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
}) {
  const labelClass = dark ? "text-sm text-gray-300" : "text-sm text-gray-700";
  const inputClass = dark
    ? "mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
    : "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
  const sectionClass = dark
    ? "rounded-xl border border-gray-800 p-4"
    : "rounded-xl border border-gray-200 p-4";

  const resetSettings = () => setSettings(DEFAULT_SETTINGS);

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Systemeinstellungen</h2>
            <Button variant="outline" onClick={resetSettings}>
              Standard wiederherstellen
            </Button>
          </div>

          <div className={sectionClass}>
            <h3 className="mb-3 font-semibold">Lageranzeige</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Mindestbestand
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={settings.lowStockThreshold}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      lowStockThreshold: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </label>

            </div>

            <p className={`mt-4 text-sm ${labelClass}`}>
              Bücher mit niedrigem Bestand werden in der Lageransicht automatisch hervorgehoben.
            </p>
          </div>

          <div className={sectionClass}>
            <h3 className="mb-3 font-semibold">Sicherheit und Komfort</h3>
            <p className={`mb-4 text-sm ${labelClass}`}>
              Diese Einstellungen wirken direkt auf Lageransicht und Datenaktualisierung.
            </p>

            <label className={`mb-4 flex items-center gap-2 ${labelClass}`}>
              <input
                type="checkbox"
                checked={settings.confirmDelete}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    confirmDelete: e.target.checked,
                  }))
                }
              />
              Löschbestätigung vor dem Entfernen eines Buchs
            </label>

            <label className={`mb-2 flex items-center gap-2 ${labelClass}`}>
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    autoRefresh: e.target.checked,
                  }))
                }
              />
              Automatisches Aktualisieren der Datenansichten
            </label>
            <p className={`mb-4 text-sm ${labelClass}`}>
              Sinnvoll, wenn Bestände parallel in einer anderen Browser-Session oder direkt über die API geändert
              werden. Für die normale Einzelplatz-Nutzung bringt es meist wenig und erzeugt nur zusätzliche
              Hintergrundabfragen.
            </p>

            <label className={labelClass}>
              Aktualisierungsintervall (Sekunden)
              <input
                className={inputClass}
                type="number"
                min={10}
                value={settings.autoRefreshSeconds}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    autoRefreshSeconds: Math.max(10, Number(e.target.value) || 10),
                  }))
                }
                disabled={!settings.autoRefresh}
              />
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  value,
  page,
  setPage,
  dark,
}: {
  icon: ReactNode;
  label: string;
  value: PageKey;
  page: PageKey;
  setPage: (page: PageKey) => void;
  dark: boolean;
}) {
  const base =
    "flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm";
  const active = dark
    ? "bg-gray-800 text-white"
    : "bg-gray-200 text-gray-900";
  const inactive = dark
    ? "text-gray-300 hover:bg-gray-800"
    : "text-gray-700 hover:bg-gray-100";

  const classes = `${base} ${page === value ? active : inactive}`;

  return (
    <button onClick={() => setPage(value)} className={classes}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
