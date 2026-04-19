import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
  ScrollText,
  Download,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

 import { Card, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { MenuButton } from "@/components/layout/MenuButton";
 import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client";

import type {
  Book,
  NewBookDraft,
  EditBookDraft,
  AppSettings,
  PurchaseOrder,
  Supplier,
  IncomingDelivery,
  SaleEntry,
  MovementApi,
  ActivityLog,
} from "@/types";

import {
  mapBookApiToBook,
  mapDraftToBookPayload,
  mapPurchaseOrderApiToOrder,
  mapIncomingDeliveryApi,
  parseSaleEntry,
} from "@/lib/mappers";

import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { OrdersPage } from "@/features/ordering/OrdersPage";
import { GoodsInPage } from "@/features/deliveries/GoodsInPage";
import { GoodsOutPage } from "@/features/sales/GoodsOutPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ActivityLogPage } from "@/features/activity/ActivityLogPage";

type PageKey =
  | "dashboard"
  | "lager"
  | "bestellen"
  | "wareneingang"
  | "verkauf"
  | "lieferanten"
  | "reports"
  | "einstellungen"
  | "activity";

const DEFAULT_SETTINGS: AppSettings = {
  lowStockThreshold: 5,
  confirmDelete: true,
  autoRefresh: false,
  autoRefreshSeconds: 30,
};

const SETTINGS_STORAGE_KEY = "bookmanager.settings";
const API_KEY_STORAGE = "buchmanagement.apiKey";

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  lager: "Lager",
  bestellen: "Bestellen",
  wareneingang: "Wareneingang",
  verkauf: "Verkauf",
  lieferanten: "Lieferanten",
  reports: "Berichte",
  einstellungen: "Einstellungen",
  activity: "Aktivitäts-Log",
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
  activity: "Alle Aktionen im System nachvollziehen.",
};

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
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [movements, setMovements] = useState<MovementApi[]>([]);
  const [incomingDeliveries, setIncomingDeliveries] = useState<IncomingDelivery[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const toggleTheme = () => setDark((prev) => !prev);

  const reloadSuppliers = async () => {
    try {
      const data = await apiGet<Supplier[]>("/suppliers", { offset: 0, limit: 100 });
      setSuppliers(data);
    } catch {
      setSuppliers([]);
    }
  };

  const reloadBooks = async () => {
    setLoadingBooks(true);
    setBookError(null);
    try {
      const data = await apiGet<BookApi[]>("/books", { offset: 0, limit: 100 });
      setBooks(data.map(mapBookApiToBook));
    } catch (err) {
      setBookError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoadingBooks(false);
    }
  };

  const reloadMovements = async () => {
    try {
      const data = await apiGet<MovementApi[]>("/movements", { offset: 0, limit: 100 });
      setMovements(data);
    } catch {
      setMovements([]);
    }
  };

  const reloadOrders = async () => {
    try {
      const data = await apiGet<PurchaseOrderApi[]>("/purchase-orders", { offset: 0, limit: 100 });
      setOrders(data.map(mapPurchaseOrderApiToOrder));
    } catch {
      setOrders([]);
    }
  };

  const reloadIncomingDeliveries = async () => {
    try {
      const data = await apiGet<IncomingDeliveryApi[]>("/incoming-deliveries", { offset: 0, limit: 100 });
      setIncomingDeliveries(data.map(mapIncomingDeliveryApi));
    } catch {
      setIncomingDeliveries([]);
    }
  };

  const reloadActivity = async () => {
    try {
      const data = await apiGet<{ logs: ActivityLog[] }>("/activity-logs", { offset: 0, limit: 50 });
      setActivityLogs(data.logs);
    } catch {
      setActivityLogs([]);
    }
  };

  useEffect(() => {
    reloadBooks();
    reloadMovements();
    reloadOrders();
    reloadIncomingDeliveries();
    reloadSuppliers();
    reloadActivity();
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!settings.autoRefresh) return;
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

  const container = dark ? "min-h-screen bg-gray-950 text-white" : "min-h-screen bg-gray-100 text-gray-900";
  const sidebar = dark ? "w-64 min-h-screen shrink-0 bg-gray-900 text-white" : "w-64 min-h-screen shrink-0 border-r bg-white text-gray-900";
  const topbar = dark ? "flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 p-6" : "flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 p-6";
  const card = dark ? "border-gray-800 bg-gray-900 text-white shadow-sm shadow-black/20" : "border-gray-200 bg-white text-gray-900 shadow-sm shadow-gray-200/60";

  return (
    <div className={container}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <div className={sidebar}>
          <div className="p-6">
            <div className="text-xl font-bold">Buchhandlung</div>
            <div className={dark ? "mt-1 text-sm text-gray-400" : "mt-1 text-sm text-gray-500"}>Lager, Einkauf und Verkauf</div>
          </div>

          <nav className="flex flex-col gap-2 px-3">
            <MenuButton icon={<BarChart3 size={18} />} label="Dashboard" value="dashboard" page={page} setPage={setPage} dark={dark} />
            <MenuButton icon={<Package size={18} />} label="Lager" value="lager" page={page} setPage={setPage} dark={dark} />
            <MenuButton icon={<Truck size={18} />} label="Bestellen" value="bestellen" page={page} setPage={setPage} dark={dark} />
            <MenuButton icon={<ShoppingBag size={18} />} label="Wareneingang" value="wareneingang" page={page} setPage={setPage} dark={dark} />
            <MenuButton icon={<ShoppingCart size={18} />} label="Verkauf" value="verkauf" page={page} setPage={setPage} dark={dark} />
            <MenuButton icon={<Building2 size={18} />} label="Lieferanten" value="lieferanten" page={page} setPage={setPage} dark={dark} />
            <MenuButton icon={<FileText size={18} />} label="Berichte" value="reports" page={page} setPage={setPage} dark={dark} />
            <MenuButton icon={<ScrollText size={18} />} label="Aktivitäts-Log" value="activity" page={page} setPage={setPage} dark={dark} />
            <MenuButton icon={<SettingsIcon size={18} />} label="Einstellungen" value="einstellungen" page={page} setPage={setPage} dark={dark} />
          </nav>
        </div>

        {/* Main Area */}
        <div className="flex-1 min-h-screen">
          {/* Topbar */}
          <div className={topbar}>
            <div>
              <h1 className="text-2xl font-semibold">{PAGE_TITLES[page]}</h1>
              <p className={dark ? "mt-1 text-sm text-gray-400" : "mt-1 text-sm text-gray-500"}>{PAGE_DESCRIPTIONS[page]}</p>
            </div>
            <Button variant="outline" onClick={toggleTheme} aria-label="Farbschema wechseln">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>

          <div className="mx-auto w-full max-w-7xl p-6">
            {page === "dashboard" && <DashboardPage card={card} stats={stats} loading={loadingBooks} salesLog={salesLog} />}
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
            {page === "lieferanten" && (
              <SuppliersPage card={card} dark={dark} suppliers={suppliers} reloadSuppliers={reloadSuppliers} />
            )}
            {page === "reports" && <ReportsPage card={card} dark={dark} onOpenDashboard={() => setPage("dashboard")} />}
            {page === "activity" && <ActivityLogPage card={card} dark={dark} />}
            {page === "einstellungen" && (
              <SettingsPage card={card} dark={dark} settings={settings} setSettings={setSettings} />
            )}
          </div>
        </div>
      </div>
    </div>
   );
 }
