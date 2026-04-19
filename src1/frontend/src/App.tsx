import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  LogOut,
  Menu,
  Moon,
  Package,
  ScrollText,
  Settings as SettingsIcon,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Truck,
  Users,
} from "lucide-react";

import { apiDelete, apiGet, apiPost, setAuthToken } from "@/api/client";
import { MenuButton } from "@/components/layout/MenuButton";
import { Button } from "@/components/ui/button";
import { ActivityLogPage } from "@/features/activity/ActivityLogPage";
import { StaffUsersPage } from "@/features/admin/StaffUsersPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { GoodsInPage } from "@/features/deliveries/GoodsInPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { OrdersPage } from "@/features/ordering/OrdersPage";
import { CatalogPage } from "@/features/catalog/CatalogPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { GoodsOutPage } from "@/features/sales/GoodsOutPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { mapBookApiToBook, mapIncomingDeliveryApi, mapPurchaseOrderApiToOrder, parseSaleEntry } from "@/lib/mappers";
import type {
  ActivityLog,
  AppSettings,
  Book,
  BookApi,
  IncomingDelivery,
  IncomingDeliveryApi,
  MovementApi,
  PurchaseOrder,
  PurchaseOrderApi,
  SaleEntry,
  StaffUserSummary,
  Supplier,
} from "@/types";

type PageKey =
  | "dashboard"
  | "lager"
  | "katalog"
  | "bestellen"
  | "wareneingang"
  | "verkauf"
  | "lieferanten"
  | "reports"
  | "einstellungen"
  | "activity"
  | "mitarbeiter";

type Me = { username: string; displayName: string; role: string };

const DEFAULT_SETTINGS: AppSettings = {
  lowStockThreshold: 5,
  confirmDelete: true,
  autoRefresh: false,
  autoRefreshSeconds: 30,
  loadDemoData: true,
};

const SETTINGS_STORAGE_KEY = "bookmanager.settings";

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  lager: "Lager",
  katalog: "Katalog",
  bestellen: "Bestellen",
  wareneingang: "Wareneingang",
  verkauf: "Verkauf",
  lieferanten: "Lieferanten",
  reports: "Berichte",
  einstellungen: "Einstellungen",
  activity: "Aktivitäts-Log",
  mitarbeiter: "Mitarbeiter",
};

const PAGE_DESCRIPTIONS: Record<PageKey, string> = {
  dashboard: "Kennzahlen, Umsatzentwicklung und aktueller Überblick.",
  lager: "Bestände pflegen, Mengen prüfen und Lagerarbeit fokussieren.",
  katalog: "Stammdaten, Preise, Beschreibung und Notizen verwalten.",
  bestellen: "Erst- und Nachbestellungen sauber anlegen und verfolgen.",
  wareneingang: "Angekommene Lieferungen prüfen und ins Lager einbuchen.",
  verkauf: "Verkäufe und Retouren direkt aus dem Bestand buchen.",
  lieferanten: "Lieferantenbeziehungen und Kontaktdaten im Blick behalten.",
  reports: "Bestandsberichte exportieren und Entwicklungen auswerten.",
  einstellungen: "Schwellenwerte, Aktualisierung und Komfortfunktionen anpassen.",
  activity: "Alle Aktionen im System nachvollziehen.",
  mitarbeiter: "PIN-Logins für Kasse verwalten.",
};

export default function Dashboard() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState<PageKey>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [movements, setMovements] = useState<MovementApi[]>([]);
  const [incomingDeliveries, setIncomingDeliveries] = useState<IncomingDelivery[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserSummary[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [demoDataBusy, setDemoDataBusy] = useState(false);
  const [demoDataStatus, setDemoDataStatus] = useState<string | null>(null);
  const [autoDemoSeeded, setAutoDemoSeeded] = useState(false);
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

  const isAdmin = me?.role === "admin";

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

  const reloadSuppliers = async () => {
    try {
      const data = await apiGet<Supplier[]>("/suppliers", { offset: 0, limit: 100 });
      setSuppliers(data);
    } catch {
      setSuppliers([]);
    }
  };

  const reloadStaffUsers = async () => {
    if (!isAdmin) {
      setStaffUsers([]);
      return;
    }
    try {
      const data = await apiGet<StaffUserSummary[]>("/staff-users");
      setStaffUsers(data);
    } catch {
      setStaffUsers([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const data = await apiGet<{ username: string; display_name: string; role: string }>("/auth/me");
        if (cancelled) return;
        setMe({ username: data.username, displayName: data.display_name, role: data.role });
      } catch {
        if (cancelled) return;
        setAuthToken(null);
        setMe(null);
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    };
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!me) return;
    reloadBooks();
    reloadMovements();
    reloadOrders();
    reloadIncomingDeliveries();
    reloadSuppliers();
    reloadStaffUsers();
  }, [me?.username]);

  useEffect(() => {
    if (!settings.autoRefresh || !me) return;
    const intervalMs = Math.max(10, settings.autoRefreshSeconds) * 1000;
    const id = window.setInterval(() => {
      reloadBooks();
      reloadMovements();
      reloadOrders();
      reloadIncomingDeliveries();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [me, settings.autoRefresh, settings.autoRefreshSeconds]);

  useEffect(() => {
    if (isAdmin) return;
    if (page !== "verkauf") setPage("verkauf");
  }, [isAdmin, page]);

  const salesLog = useMemo(
    () =>
      movements
        .map(parseSaleEntry)
        .filter((entry): entry is SaleEntry => entry !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [movements],
  );

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

  const isSalesWorkspace = page === "verkauf";
  const showSidebar = isAdmin;

  const container = dark ? "min-h-screen bg-gray-950 text-white" : "min-h-screen bg-gray-100 text-gray-900";
  const sidebar = dark
    ? "w-64 min-h-screen shrink-0 bg-gray-900 text-white"
    : "w-64 min-h-screen shrink-0 border-r bg-white text-gray-900";
  const topbar = dark
    ? "flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 p-6"
    : "flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 p-6";
  const card = dark
    ? "border-gray-800 bg-gray-900 text-white shadow-sm shadow-black/20"
    : "border-gray-200 bg-white text-gray-900 shadow-sm shadow-gray-200/60";

  const logout = () => {
    setAuthToken(null);
    setMe(null);
    setPage("dashboard");
    setMobileNavOpen(false);
  };

  const setPageAndCloseMobileNav = (nextPage: PageKey) => {
    setPage(nextPage);
    setMobileNavOpen(false);
  };

  const seedDemoData = async () => {
    setDemoDataStatus(null);
    setDemoDataBusy(true);
    try {
      const result = await apiPost<{ message?: string; stats?: Record<string, number> }, Record<string, never>>("/test-data/seed", {});
      await Promise.all([reloadBooks(), reloadOrders(), reloadIncomingDeliveries(), reloadMovements(), reloadSuppliers()]);
      const statText = result.stats ? ` (${Object.keys(result.stats).length} Bereiche)` : "";
      setDemoDataStatus((result.message || "Demo-Daten geladen") + statText);
    } catch (err) {
      setDemoDataStatus(err instanceof Error ? err.message : "Demo-Daten konnten nicht geladen werden");
    } finally {
      setDemoDataBusy(false);
    }
  };

  const clearDemoData = async () => {
    setDemoDataStatus(null);
    setDemoDataBusy(true);
    try {
      await apiDelete("/test-data/clear");
      await Promise.all([reloadBooks(), reloadOrders(), reloadIncomingDeliveries(), reloadMovements(), reloadSuppliers()]);
      setDemoDataStatus("Demo-Daten wurden bereinigt");
    } catch (err) {
      setDemoDataStatus(err instanceof Error ? err.message : "Demo-Daten konnten nicht gelöscht werden");
    } finally {
      setDemoDataBusy(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !settings.loadDemoData || autoDemoSeeded || loadingBooks || demoDataBusy) return;
    if (books.length > 0) {
      setAutoDemoSeeded(true);
      return;
    }
    setAutoDemoSeeded(true);
    seedDemoData();
  }, [isAdmin, settings.loadDemoData, autoDemoSeeded, loadingBooks, demoDataBusy, books.length]);

  if (authChecking) {
    return <div className={container + " flex min-h-screen items-center justify-center"}>Sitzung wird geladen...</div>;
  }

  if (!me) {
    return <LoginPage dark={dark} onToggleDark={() => setDark((prev) => !prev)} onLoggedIn={setMe} />;
  }

  return (
    <div className={container}>
      <div className="flex min-h-screen">
        {showSidebar && mobileNavOpen && (
          <button type="button" aria-label="Menü schließen" className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileNavOpen(false)} />
        )}

        {showSidebar && (
          <div
            className={`${sidebar} fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 md:static md:translate-x-0 ${
              mobileNavOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="p-6">
              <div className="text-xl font-bold">Buchhandlung</div>
              <div className={dark ? "mt-1 text-sm text-gray-400" : "mt-1 text-sm text-gray-500"}>Administration & Lager</div>
            </div>

            <nav className="flex flex-col gap-2 px-3">
              <MenuButton icon={<BarChart3 size={18} />} label="Dashboard" value="dashboard" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<Package size={18} />} label="Lager" value="lager" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<BookOpen size={18} />} label="Katalog" value="katalog" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<Truck size={18} />} label="Bestellen" value="bestellen" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<ShoppingBag size={18} />} label="Wareneingang" value="wareneingang" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<ShoppingCart size={18} />} label="Verkauf" value="verkauf" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<Building2 size={18} />} label="Lieferanten" value="lieferanten" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<FileText size={18} />} label="Berichte" value="reports" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<ScrollText size={18} />} label="Aktivitäts-Log" value="activity" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<Users size={18} />} label="Mitarbeiter" value="mitarbeiter" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
              <MenuButton icon={<SettingsIcon size={18} />} label="Einstellungen" value="einstellungen" page={page} setPage={setPageAndCloseMobileNav} dark={dark} />
            </nav>

            <div className="mt-auto p-3">
              <Button variant="outline" onClick={logout} className="w-full justify-start gap-2">
                <LogOut size={16} /> Abmelden
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-screen md:ml-0">
          <div className={isSalesWorkspace ? `${topbar} ${showSidebar ? "" : "sticky top-0 z-20 bg-inherit backdrop-blur"}` : topbar}>
            <div>
              {showSidebar && (
                <div className="mb-3 md:hidden">
                  <Button variant="outline" onClick={() => setMobileNavOpen((prev) => !prev)}>
                    <Menu size={18} className="mr-2" /> Menü
                  </Button>
                </div>
              )}
              <h1 className="text-2xl font-semibold">{PAGE_TITLES[page]}</h1>
              <p className={dark ? "mt-1 text-sm text-gray-400" : "mt-1 text-sm text-gray-500"}>{PAGE_DESCRIPTIONS[page]}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={dark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>{me.displayName}</div>
              {!showSidebar && (
                <Button variant="outline" onClick={logout} className="gap-2">
                  <LogOut size={16} /> Abmelden
                </Button>
              )}
              <Button variant="outline" onClick={() => setDark((prev) => !prev)} aria-label="Farbschema wechseln">
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
            </div>
          </div>

          <div className={isSalesWorkspace ? "w-full p-4 sm:p-6" : "mx-auto w-full max-w-7xl p-6"}>
            {page === "dashboard" && isAdmin && <DashboardPage card={card} stats={stats} loading={loadingBooks} salesLog={salesLog} />}
            {page === "lager" && isAdmin && (
              <InventoryPage
                card={card}
                books={books}
                loading={loadingBooks}
                error={bookError}
                dark={dark}
                settings={settings}
                updateBookInState={(updatedBook: Book) =>
                  setBooks((prev) => prev.map((book) => (book.id === updatedBook.id ? updatedBook : book)))
                }
              />
            )}
            {page === "katalog" && isAdmin && (
              <CatalogPage
                card={card}
                dark={dark}
                books={books}
                setBooks={setBooks}
                updateBookInState={(updatedBook: Book) =>
                  setBooks((prev) => prev.map((book) => (book.id === updatedBook.id ? updatedBook : book)))
                }
              />
            )}
            {page === "bestellen" && isAdmin && (
              <OrdersPage
                card={card}
                dark={dark}
                books={books}
                addBookToState={(book: Book) => setBooks((prev) => [book, ...prev])}
                suppliers={suppliers}
                orders={orders}
                setOrders={setOrders}
                setIncomingDeliveries={setIncomingDeliveries}
                reloadOrders={reloadOrders}
                reloadIncomingDeliveries={reloadIncomingDeliveries}
              />
            )}
            {page === "wareneingang" && isAdmin && (
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
            {page === "lieferanten" && isAdmin && <SuppliersPage card={card} dark={dark} suppliers={suppliers} reloadSuppliers={reloadSuppliers} />}
            {page === "reports" && isAdmin && <ReportsPage card={card} dark={dark} onOpenDashboard={() => setPage("dashboard")} />}
            {page === "activity" && isAdmin && <ActivityLogPage card={card} dark={dark} />}
            {page === "mitarbeiter" && isAdmin && (
              <StaffUsersPage card={card} dark={dark} users={staffUsers} reloadUsers={reloadStaffUsers} />
            )}
            {page === "einstellungen" && isAdmin && (
              <SettingsPage
                card={card}
                dark={dark}
                settings={settings}
                setSettings={setSettings}
                onSeedDemoData={seedDemoData}
                onClearDemoData={clearDemoData}
                demoDataBusy={demoDataBusy}
                demoDataStatus={demoDataStatus}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
