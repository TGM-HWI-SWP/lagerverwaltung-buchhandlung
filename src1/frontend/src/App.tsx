import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Sun,
  Moon,
  Package,
  Truck,
  ShoppingBag,
  ShoppingCart,
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
  | "wareneingang"
  | "warenausgang"
  | "bestellentwicklung"
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
  currency: "EUR" | "USD" | "CHF";
  confirmDelete: boolean;
  compactTable: boolean;
  autoRefresh: boolean;
  autoRefreshSeconds: number;
};

type OrderStatus = "offen" | "geliefert";

type PurchaseOrder = {
  id: string;
  supplierId?: string;
  supplier: string;
  bookId: string;
  bookName: string;
  bookSku?: string;
  unitPrice?: number;
  quantity: number;
  status: OrderStatus;
  createdAt: string;
  deliveredAt?: string;
};

type NewOrderDraft = {
  supplierId: string;
  name: string;
  quantity: string;
};

type Supplier = {
  id: string;
  name: string;
};

type SupplierStockEntry = {
  book_id: string;
  book_name: string;
  quantity: number;
  price: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  lowStockThreshold: 5,
  currency: "EUR",
  confirmDelete: true,
  compactTable: false,
  autoRefresh: false,
  autoRefreshSeconds: 30,
};

const SETTINGS_STORAGE_KEY = "bookmanager.settings";
const ORDERS_STORAGE_KEY = "bookmanager.orders";
const OUTBOUND_LOG_STORAGE_KEY = "bookmanager.outboundLog";

type OutboundType = "Verkauf";

type OutboundEntry = {
  id: string;
  bookId: string;
  bookName: string;
  type: OutboundType;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
};
export default function Dashboard() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState<PageKey>("dashboard");
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw) as PurchaseOrder[];
    } catch {
      return [];
    }
  });
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
  const [outboundLog, setOutboundLog] = useState<OutboundEntry[]>(() => {
    try {
      const raw = localStorage.getItem(OUTBOUND_LOG_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw) as OutboundEntry[];
    } catch {
      return [];
    }
  });
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierStock, setSupplierStock] = useState<SupplierStockEntry[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const toggleTheme = () => setDark((prev) => !prev);

  const reloadBooks = () => {
    setLoadingBooks(true);
    setBookError(null);
    apiGet<Book[]>("/books")
      .then((data: Book[]) => setBooks(data))
      .catch((err: Error) => setBookError(err.message))
      .finally(() => setLoadingBooks(false));
  };

  useEffect(() => {
    reloadBooks();
  }, []);

  useEffect(() => {
    const loadSupplierInventory = async () => {
      setSupplierLoading(true);
      setSupplierError(null);
      try {
        const allSuppliers = await apiGet<Supplier[]>("/suppliers");
        setSuppliers(allSuppliers);
        const firstSupplier = allSuppliers[0] ?? null;
        setSupplier(firstSupplier);
        if (!firstSupplier) {
          setSupplierStock([]);
          return;
        }
        const stock = await apiGet<SupplierStockEntry[]>(`/suppliers/${firstSupplier.id}/stock`);
        setSupplierStock(stock);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unbekannter Fehler";
        setSupplierError(message);
      } finally {
        setSupplierLoading(false);
      }
    };
    loadSupplierInventory();
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(OUTBOUND_LOG_STORAGE_KEY, JSON.stringify(outboundLog));
  }, [outboundLog]);

  useEffect(() => {
    if (!settings.autoRefresh) {
      return;
    }
    const intervalMs = Math.max(10, settings.autoRefreshSeconds) * 1000;
    const id = window.setInterval(() => {
      reloadBooks();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [settings.autoRefresh, settings.autoRefreshSeconds]);

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
    const totalRevenue = outboundLog
      .filter((entry) => entry.type === "Verkauf")
      .reduce((sum, entry) => sum + entry.total, 0);
    return { totalBooks, categories, totalUnits, totalValue, totalRevenue };
  }, [books, outboundLog]);

  const container = dark
    ? "min-h-screen bg-gray-950 text-white"
    : "min-h-screen bg-gray-100 text-gray-900";

  const sidebar = dark
    ? "w-64 min-h-screen shrink-0 bg-gray-900 text-white"
    : "w-64 min-h-screen shrink-0 border-r bg-white text-gray-900";

  const topbar = dark
    ? "flex justify-between items-center p-6 border-b border-gray-800"
    : "flex justify-between items-center p-6 border-b border-gray-200";

  const card = dark
    ? "bg-gray-900 border-gray-800 text-white"
    : "bg-white border-gray-200 text-gray-900";

  return (
    <div className={container}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <div className={sidebar}>
          <div className="p-6 text-xl font-bold">BookManager</div>

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
              label="Wareneingang"
              value="wareneingang"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<ShoppingBag size={18} />}
              label="Warenausgang"
              value="warenausgang"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<ShoppingCart size={18} />}
              label="Bestellentwicklung"
              value="bestellentwicklung"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<FileText size={18} />}
              label="Reports"
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
            <h1 className="text-2xl font-semibold capitalize">{page}</h1>

            <Button variant="outline" onClick={toggleTheme}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>

          <div className="p-6">
            {page === "dashboard" && (
              <DashboardPage card={card} stats={stats} loading={loadingBooks} outboundLog={outboundLog} />
            )}
            {page === "lager" && (
              <InventoryPage
                card={card}
                books={books}
                loading={loadingBooks}
                error={bookError}
                dark={dark}
                settings={settings}
                updateBookInState={updateBookInState}
              />
            )}
            {page === "wareneingang" && (
              <GoodsInPage
                card={card}
                dark={dark}
                addBookToState={addBookToState}
                setOrders={setOrders}
                supplier={supplier}
                supplierStock={supplierStock}
                supplierLoading={supplierLoading}
                supplierError={supplierError}
                reloadBooks={reloadBooks}
                suppliers={suppliers}
              />
            )}
            {page === "warenausgang" && (
              <GoodsOutPage
                card={card}
                dark={dark}
                books={books}
                reloadBooks={reloadBooks}
                outboundLog={outboundLog}
                setOutboundLog={setOutboundLog}
              />
            )}
            {page === "reports" && <ReportsPage card={card} />}
            {page === "bestellentwicklung" && (
              <OrderDevelopmentPage
                card={card}
                dark={dark}
                orders={orders}
                setOrders={setOrders}
                reloadBooks={reloadBooks}
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
  outboundLog,
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
  outboundLog: OutboundEntry[];
}) {
  const revenueData = useMemo(() => {
    const monthlyRevenue: { [key: string]: number } = {};
    outboundLog
      .filter((entry) => entry.type === "Verkauf")
      .forEach((entry) => {
        const date = new Date(entry.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + entry.total;
      });
    return Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [outboundLog]);

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
  loading,
  error,
  dark,
  settings,
  updateBookInState,
}: {
  card: string;
  books: Book[];
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
  const currencySymbol =
    settings.currency === "USD" ? "$" : settings.currency === "CHF" ? "CHF" : "€";
  const rowPaddingClass = settings.compactTable ? "py-1" : "py-2";
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
    setEditOpen(true);
  };

  const onEditSave = async () => {
    if (!editingBookId) {
      return;
    }
    setEditing(true);
    setEditError(null);
    try {
      const updated = await apiPut<Book, Partial<Book>>(`/books/${editingBookId}`, {
        id: editingBookId,
        name: editDraft.name.trim(),
        author: editDraft.author.trim(),
        description: editDraft.description.trim() || "-",
        purchasePrice: Number(editDraft.purchasePrice) || 0,
        sellingPrice: Number(editDraft.sellingPrice) || 0,
        quantity: Number(editDraft.quantity) || 0,
        sku: editDraft.sku.trim(),
        category: editDraft.category.trim(),
        notes: editDraft.notes.trim() || null,
      });
      updateBookInState(updated);
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
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setEditError(message);
    } finally {
      setDeleting(false);
    }
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
            <Button onClick={() => setSearch("")}>Reset</Button>
          </div>

          {editOpen && (
            <div className={`mb-6 rounded-xl border p-4 ${tableBorder}`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">Buch bearbeiten</h3>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                  X
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
                  <Button variant="destructive" onClick={() => setDeleteConfirm(true)}>
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
            <table className="mt-2 w-full text-left text-sm">
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
                      {(book.sellingPrice || book.price || 0).toFixed(2)} {currencySymbol}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsPage({ card }: { card: string }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Report A</h2>
          <p>Lagerbestandsbericht anzeigen oder exportieren.</p>
          <Button className="mt-4" onClick={downloadInventoryPdf} disabled={downloading}>
            {downloading ? "Erstelle PDF…" : "Report generieren"}
          </Button>
          {downloadError && (
            <p className="mt-2 text-sm text-red-400">Fehler: {downloadError}</p>
          )}
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Report B</h2>
          <p>Bestandsentwicklung als Grafik anzeigen.</p>
          <Button className="mt-4">Grafik anzeigen</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function GoodsInPage({
  card,
  dark,
  addBookToState,
  setOrders,
  supplier,
  supplierStock,
  supplierLoading,
  supplierError,
  reloadBooks,
  suppliers,
}: {
  card: string;
  dark: boolean;
  addBookToState: (book: Book) => void;
  setOrders: Dispatch<SetStateAction<PurchaseOrder[]>>;
  supplier: Supplier | null;
  supplierStock: SupplierStockEntry[];
  supplierLoading: boolean;
  supplierError: string | null;
  reloadBooks: () => void;
  suppliers: Supplier[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingBook, setCreatingBook] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
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
  const [draft, setDraft] = useState<NewOrderDraft>({
    supplierId: "",
    name: "",
    quantity: "",
  });
  const [creating, setCreating] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const formInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";
  useEffect(() => {
    if (supplier) {
      setDraft((prev) => ({ ...prev, supplierId: supplier.id }));
    }
  }, [supplier]);

  const supplierBooks = useMemo(() => supplierStock, [supplierStock]);
  const selectedSupplierBook = useMemo(() => {
    return supplierBooks.find((book) => book.book_name === draft.name.trim()) ?? null;
  }, [supplierBooks, draft.name]);

  const onCreateBook = async () => {
    setBookError(null);
    setCreatingBook(true);
    try {
      const createdBook = await apiPost<Book, Partial<Book>>("/books", {
        name: bookDraft.name.trim(),
        author: bookDraft.author.trim(),
        description: bookDraft.description.trim() || "-",
        purchasePrice: Number(bookDraft.purchasePrice) || 0,
        sellingPrice: Number(bookDraft.sellingPrice) || 0,
        quantity: Number(bookDraft.quantity) || 0,
        sku: bookDraft.sku.trim() || `AUTO-${Date.now()}`,
        category: bookDraft.category.trim(),
        notes: bookDraft.notes.trim() || null,
      });
      addBookToState(createdBook);
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

  const createOrder = async () => {
    setOrderError(null);
    setCreating(true);
    const quantity = Number(draft.quantity);
    try {
      if (!supplier || !draft.supplierId) {
        setOrderError("Bitte Lieferant angeben.");
        return;
      }
      if (!draft.name.trim()) {
        setOrderError("Bitte Buchtitel angeben.");
        return;
      }
      if (!selectedSupplierBook) {
        setOrderError("Bitte ein Buch aus dem Lieferantenlager waehlen.");
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setOrderError("Bitte eine gueltige Bestellmenge > 0 eingeben.");
        return;
      }

      const newOrder: PurchaseOrder = {
        id: `ord-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        supplierId: draft.supplierId,
        supplier: supplier.name,
        bookId: selectedSupplierBook.book_id,
        bookName: selectedSupplierBook.book_name,
        bookSku: "",
        unitPrice: selectedSupplierBook.price,
        quantity: Math.round(quantity),
        status: "offen",
        createdAt: new Date().toISOString(),
      };

      setOrders((prev) => [newOrder, ...prev]);
      setDraft({
        supplierId: supplier.id,
        name: "",
        quantity: "",
      });
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Wareneingang</h2>
          <div>
            <Button onClick={() => setCreateOpen((v) => !v)} variant="outline">
              {createOpen ? "Neues Buch schliessen" : "Neues Buch anlegen"}
            </Button>
          </div>

          {createOpen && (
            <div className={`rounded-xl border p-4 ${tableBorder}`}>
              <h3 className="mb-3 text-base font-semibold">Neues Buch anlegen</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  className={formInputClass}
                  placeholder="Name *"
                  value={bookDraft.name}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  className={formInputClass}
                  placeholder="Autor"
                  value={bookDraft.author}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, author: e.target.value }))}
                />
                <input
                  className={formInputClass}
                  placeholder="Kategorie"
                  value={bookDraft.category}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, category: e.target.value }))}
                />
                <input
                  className={formInputClass}
                  placeholder="SKU (Auto-generiert)"
                  value={bookDraft.sku}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, sku: e.target.value }))}
                />
                <input
                  className={formInputClass}
                  placeholder="Einkaufspreis"
                  inputMode="decimal"
                  value={bookDraft.purchasePrice}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                />
                <input
                  className={formInputClass}
                  placeholder="Verkaufspreis"
                  inputMode="decimal"
                  value={bookDraft.sellingPrice}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, sellingPrice: e.target.value }))}
                />
                <input
                  className={formInputClass}
                  placeholder="Bestand"
                  inputMode="numeric"
                  value={bookDraft.quantity}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                />
                <select
                  className={formInputClass}
                  value={bookDraft.supplierId}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, supplierId: e.target.value }))}
                >
                  <option value="">Lieferant auswählen</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
                <input
                  className={`${formInputClass} md:col-span-2`}
                  placeholder="Beschreibung"
                  value={bookDraft.description}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, description: e.target.value }))}
                />
                <input
                  className={`${formInputClass} md:col-span-2`}
                  placeholder="Notizen"
                  value={bookDraft.notes}
                  onChange={(e) => setBookDraft((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="mt-4">
                <Button onClick={onCreateBook} disabled={creatingBook || bookDraft.name.trim() === ""}>
                  {creatingBook ? "Speichere..." : "Buch speichern"}
                </Button>
                {bookError ? <span className="ml-3 text-sm text-red-400">{bookError}</span> : null}
              </div>
            </div>
          )}

          <p className={`text-sm ${mutedText}`}>
            Wareneingang per Lieferant: Bestellung erfassen und spaeter in Bestellentwicklung
            einbuchen.
          </p>

          <div className={`grid grid-cols-1 gap-3 rounded-xl border p-4 ${tableBorder} md:grid-cols-2`}>
            <select
              className={formInputClass}
              value={supplier?.id ?? ""}
              onChange={() => null}
              disabled
            >
              <option value={supplier?.id ?? ""}>{supplier?.name ?? "Kein Lieferant gefunden"}</option>
            </select>
            <input
              className={formInputClass}
              placeholder="Buchtitel aus Lieferantenlager *"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              list="supplier-book-list"
              disabled={!supplier}
            />
            <input
              className={`${formInputClass} ${dark ? "bg-gray-900" : "bg-gray-100"}`}
              value={
                selectedSupplierBook
                  ? `Preis: ${selectedSupplierBook.price.toFixed(2)} EUR`
                  : "Preis: Buch wählen"
              }
              readOnly
            />
            <datalist id="supplier-book-list">
              {supplierBooks.map((book) => (
                <option key={book.book_id} value={book.book_name} />
              ))}
            </datalist>

            <input
              className={formInputClass}
              type="number"
              min={1}
              placeholder="Menge"
              value={draft.quantity}
              onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
            />

            <div className="md:col-span-2">
              <Button
                onClick={createOrder}
                disabled={creating || !supplier || !draft.name.trim() || supplierBooks.length === 0}
              >
                {creating ? "Bestelle..." : "Bestellung anlegen"}
              </Button>
              {orderError && <span className="ml-3 text-sm text-red-400">{orderError}</span>}
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${tableBorder}`}>
            <h3 className="mb-2 text-base font-semibold">Bücher im Lager des Lieferanten</h3>
            {supplierLoading && <p className={`text-sm ${mutedText}`}>Lade Lieferantenlager...</p>}
            {supplierError && <p className="text-sm text-red-400">{supplierError}</p>}
            {!supplierLoading && !supplierError && !supplier && (
              <p className={`text-sm ${mutedText}`}>Kein Lieferant vorhanden.</p>
            )}
            {!supplierLoading && !supplierError && supplier && supplierBooks.length === 0 && (
              <p className={`text-sm ${mutedText}`}>Für diesen Lieferanten sind keine Titel hinterlegt.</p>
            )}
            {!supplierLoading && !supplierError && supplierBooks.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {supplierBooks.map((book) => (
                  <li key={book.book_id}>
                    {book.book_name} - {book.price.toFixed(2)} EUR
                  </li>
                ))}
              </ul>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

function OrderDevelopmentPage({
  card,
  dark,
  orders,
  setOrders,
  reloadBooks,
}: {
  card: string;
  dark: boolean;
  orders: PurchaseOrder[];
  setOrders: Dispatch<SetStateAction<PurchaseOrder[]>>;
  reloadBooks: () => void;
}) {
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const [orderError, setOrderError] = useState<string | null>(null);

  const markOrderAsDelivered = async (orderId: string) => {
    const order = orders.find((entry) => entry.id === orderId);
    const supplierId = order?.supplierId;
    if (!order || order.status === "geliefert" || !supplierId) {
      return;
    }
    try {
      await apiPost("/suppliers/" + supplierId + "/order", {
        book_id: order.bookId,
        quantity: order.quantity,
        performed_by: "ui",
      });
      setOrders((prev) =>
        prev.map((entry) =>
          entry.id === orderId
            ? {
                ...entry,
                status: "geliefert",
                deliveredAt: new Date().toISOString(),
              }
            : entry
        )
      );
      reloadBooks();
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Bestellentwicklung</h2>
          {orderError ? <p className="text-sm text-red-400">{orderError}</p> : null}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                <th className="py-2">Lieferant</th>
                <th>Buch</th>
                <th>Preis</th>
                <th>Menge</th>
                <th>Status</th>
                <th className="text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td className={`py-4 ${mutedText}`} colSpan={6}>
                    Noch keine Bestellungen vorhanden.
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className={`border-b ${tableBorder} last:border-b-0`}>
                  <td className="py-2">{order.supplier}</td>
                  <td>{order.bookName || "Unbekanntes Buch"}</td>
                  <td>{order.unitPrice != null ? `${order.unitPrice.toFixed(2)} EUR` : "-"}</td>
                  <td>{order.quantity}</td>
                  <td>
                    <span
                      className={
                        order.status === "geliefert"
                          ? "rounded-md bg-emerald-700/30 px-2 py-1 text-xs text-emerald-300"
                          : "rounded-md bg-amber-700/30 px-2 py-1 text-xs text-amber-300"
                      }
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="text-right">
                    {order.status === "offen" ? (
                      <Button size="sm" onClick={() => markOrderAsDelivered(order.id)}>
                        Als geliefert markieren
                      </Button>
                    ) : (
                      <span className={`text-xs ${mutedText}`}>Bereits eingebucht</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  outboundLog,
  setOutboundLog,
}: {
  card: string;
  dark: boolean;
  books: Book[];
  reloadBooks: () => void;
  outboundLog: OutboundEntry[];
  setOutboundLog: Dispatch<SetStateAction<OutboundEntry[]>>;
}) {
  const [bookId, setBookId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [outboundType, setOutboundType] = useState<OutboundType>("Verkauf");
  const [sellingPrice, setSellingPrice] = useState("");
  const [selling, setSelling] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleSuccess, setSaleSuccess] = useState<string | null>(null);
  const formInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const selectedBook = useMemo(() => books.find((book) => book.id === bookId) ?? null, [books, bookId]);

  useEffect(() => {
    if (selectedBook) {
      setSellingPrice(String(selectedBook.sellingPrice || selectedBook.price || 0));
    } else {
      setSellingPrice("");
    }
  }, [selectedBook]);

  const onSell = async () => {
    const qty = Number(quantity);
    const price = Number(sellingPrice);
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
    setSelling(true);
    try {
      await apiPost("/movements", {
        book_id: selectedBook.id,
        book_name: selectedBook.name,
        quantity_change: Math.round(qty),
        movement_type: "OUT",
        reason: outboundType,
        performed_by: "ui",
      });
      const nextEntry: OutboundEntry = {
        id: `out-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        bookId: selectedBook.id,
        bookName: selectedBook.name,
        type: outboundType,
        quantity: Math.round(qty),
        unitPrice: price,
        total: price * Math.round(qty),
        createdAt: new Date().toISOString(),
      };
      setOutboundLog((prev) => [nextEntry, ...prev]);
      setSaleSuccess(
        `${Math.round(qty)} Stk. von "${selectedBook.name}" als ${outboundType.toLowerCase()} gebucht.`
      );
      setQuantity("1");
      reloadBooks();
    } catch (err) {
      setSaleError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSelling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Warenausgang / Verkauf</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select className={formInputClass} value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">Buch aus Lager waehlen</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name} ({book.quantity} Stk.)
                </option>
              ))}
            </select>
            <input
              className={formInputClass}
              type="number"
              min={1}
              placeholder="Menge"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                className={formInputClass}
                value={outboundType}
                onChange={(e) => setOutboundType(e.target.value as OutboundType)}
              >
                <option value="Verkauf">Verkauf</option>
                <option value="Leihe">Leihe</option>
              </select>
              <input
                className={formInputClass}
                placeholder="Verkaufspreis (EUR)"
                inputMode="decimal"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Button onClick={onSell} disabled={selling}>
              {selling ? "Buche Warenausgang..." : "Verkauf buchen"}
            </Button>
            {saleError ? <span className="ml-3 text-sm text-red-400">{saleError}</span> : null}
            {saleSuccess ? <span className="ml-3 text-sm text-emerald-400">{saleSuccess}</span> : null}
          </div>
          <div className={`rounded-xl border p-4 ${tableBorder}`}>
            <h3 className="mb-3 text-base font-semibold">Warenausgang Verlauf</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                  <th className="py-2">Datum</th>
                  <th>Buch</th>
                  <th>Art</th>
                  <th>Menge</th>
                  <th>Preis/Stk.</th>
                  <th>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {outboundLog.length === 0 ? (
                  <tr>
                    <td className={`py-4 ${mutedText}`} colSpan={6}>
                      Noch kein Warenausgang gebucht.
                    </td>
                  </tr>
                ) : (
                  outboundLog.map((entry) => (
                    <tr key={entry.id} className={`border-b ${tableBorder} last:border-b-0`}>
                      <td className="py-2">{new Date(entry.createdAt).toLocaleString("de-AT")}</td>
                      <td>{entry.bookName}</td>
                      <td>{entry.type}</td>
                      <td>{entry.quantity}</td>
                      <td>{entry.unitPrice.toFixed(2)} EUR</td>
                      <td>{entry.total.toFixed(2)} EUR</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                Low-Stock-Schwelle
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

              <label className={labelClass}>
                Waehrung
                <select
                  className={inputClass}
                  value={settings.currency}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      currency: e.target.value as AppSettings["currency"],
                    }))
                  }
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="CHF">CHF</option>
                </select>
              </label>
            </div>

            <label className={`mt-4 flex items-center gap-2 ${labelClass}`}>
              <input
                type="checkbox"
                checked={settings.compactTable}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    compactTable: e.target.checked,
                  }))
                }
              />
              Kompakte Tabellenansicht im Lager
            </label>
          </div>

          <div className={sectionClass}>
            <h3 className="mb-3 font-semibold">Sicherheit und Komfort</h3>

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
              Loeschbestaetigung vor dem Entfernen eines Buchs
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
              Automatisches Aktualisieren der Buchliste
            </label>

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

