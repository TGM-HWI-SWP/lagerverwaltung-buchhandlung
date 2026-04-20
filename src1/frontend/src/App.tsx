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

import { apiGet, setAuthToken } from "@/api/client";
import { MenuButton } from "@/components/layout/MenuButton";
import { Button } from "@/components/ui/button";
import { ActivityLogPage } from "@/features/activity/ActivityLogPage";
import { StaffUsersPage } from "@/features/admin/StaffUsersPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { CatalogPage } from "@/features/catalog/CatalogPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { GoodsInPage } from "@/features/deliveries/GoodsInPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { OrdersPage } from "@/features/ordering/OrdersPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { GoodsOutPage } from "@/features/sales/GoodsOutPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import {
  mapCatalogProductApi,
  mapPurchaseOrderApi,
  mapSaleOrderApi,
  mapStockEntryApi,
  mapStockLedgerEntryApi,
  mapWarehouseApi,
} from "@/lib/mappers";
import type {
  AppSettings,
  CatalogProduct,
  CatalogProductApi,
  PurchaseOrder,
  PurchaseOrderApi,
  SaleOrder,
  SaleOrderApi,
  StaffUserSummary,
  StockEntry,
  StockEntryApi,
  StockLedgerEntry,
  StockLedgerEntryApi,
  Supplier,
  Warehouse,
  WarehouseApi,
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
};

const SETTINGS_STORAGE_KEY = "bookmanager.settings";

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  lager: "Bestände & Ledger",
  katalog: "Katalog",
  bestellen: "Einkauf",
  wareneingang: "Wareneingang",
  verkauf: "Verkauf",
  lieferanten: "Lieferanten",
  reports: "Berichte",
  einstellungen: "Einstellungen",
  activity: "Aktivitäts-Log",
  mitarbeiter: "Mitarbeiter",
};

const PAGE_DESCRIPTIONS: Record<PageKey, string> = {
  dashboard: "Kennzahlen und Umsatzentwicklung aus Katalog, Stock und Verkauf.",
  lager: "Lagerorte, Bestände und das Stock Ledger in einer Sicht.",
  katalog: "Produktstammdaten, Preise und Lieferantenverknüpfungen pflegen.",
  bestellen: "Mehrzeilige Einkaufsbestellungen anlegen und verfolgen.",
  wareneingang: "Bestellzeilen pro Lagerort empfangen und einbuchen.",
  verkauf: "Verkäufe und Retouren direkt auf Lagerorte buchen.",
  lieferanten: "Lieferanten als eigene Stammdaten verwalten.",
  reports: "Bestandsberichte exportieren und Dashboard ergänzen.",
  einstellungen: "Schwellenwerte, Aktualisierung und Komfortfunktionen steuern.",
  activity: "Audit- und Aktivitätsprotokoll des Systems.",
  mitarbeiter: "PIN-Logins und Rollen für das Team verwalten.",
};

export default function Dashboard() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState<PageKey>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SaleOrder[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserSummary[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
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

  const reloadProducts = async () => {
    const data = await apiGet<CatalogProductApi[]>("/catalog-products");
    setProducts(data.map(mapCatalogProductApi));
  };

  const reloadWarehouses = async () => {
    const data = await apiGet<WarehouseApi[]>("/warehouses");
    setWarehouses(data.map(mapWarehouseApi));
  };

  const reloadStockEntries = async () => {
    const data = await apiGet<StockEntryApi[]>("/stock-items", { include_zero: true });
    setStockEntries(data.map(mapStockEntryApi));
  };

  const reloadLedgerEntries = async () => {
    const data = await apiGet<StockLedgerEntryApi[]>("/stock-ledger", { limit: 100 });
    setLedgerEntries(data.map(mapStockLedgerEntryApi));
  };

  const reloadSuppliers = async () => {
    const data = await apiGet<Supplier[]>("/suppliers");
    setSuppliers(data);
  };

  const reloadOrders = async () => {
    const data = await apiGet<PurchaseOrderApi[]>("/purchase-orders");
    setOrders(data.map(mapPurchaseOrderApi));
  };

  const reloadSalesOrders = async () => {
    const data = await apiGet<SaleOrderApi[]>("/sales-orders");
    setSalesOrders(data.map(mapSaleOrderApi));
  };

  const reloadStaffUsers = async () => {
    if (!isAdmin) {
      setStaffUsers([]);
      return;
    }
    const data = await apiGet<StaffUserSummary[]>("/staff-users");
    setStaffUsers(data);
  };

  const reloadAllData = async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      await Promise.all([
        reloadProducts(),
        reloadWarehouses(),
        reloadStockEntries(),
        reloadLedgerEntries(),
        reloadSuppliers(),
        reloadOrders(),
        reloadSalesOrders(),
        reloadStaffUsers(),
      ]);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Daten konnten nicht geladen werden.");
    } finally {
      setLoadingData(false);
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
    reloadAllData();
  }, [me?.username, isAdmin]);

  useEffect(() => {
    if (!settings.autoRefresh || !me) return;
    const intervalMs = Math.max(10, settings.autoRefreshSeconds) * 1000;
    const id = window.setInterval(() => {
      reloadAllData();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [me, settings.autoRefresh, settings.autoRefreshSeconds, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (page !== "verkauf") setPage("verkauf");
  }, [isAdmin, page]);

  const stats = useMemo(() => {
    const totalProducts = products.filter((product) => product.isActive).length;
    const categories = new Set(products.map((product) => product.category).filter(Boolean)).size;
    const totalUnits = stockEntries.reduce((sum, entry) => sum + entry.onHand, 0);
    const totalValue = stockEntries.reduce((sum, entry) => sum + entry.onHand * entry.sellingPrice, 0);
    const totalRevenue = salesOrders.reduce((sum, order) => sum + order.total, 0);
    return { totalProducts, categories, totalUnits, totalValue, totalRevenue };
  }, [products, stockEntries, salesOrders]);

  const topBarCard = dark
    ? "rounded-[2rem] border border-gray-800 bg-gray-900/70 backdrop-blur"
    : "rounded-[2rem] border border-gray-200 bg-white/90 shadow-sm";
  const card = dark
    ? "rounded-[2rem] border border-gray-800 bg-gray-900/70 backdrop-blur"
    : "rounded-[2rem] border border-gray-200 bg-white/95 shadow-sm";
  const shell = dark
    ? "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_40%),linear-gradient(135deg,#06070b_0%,#0f172a_48%,#09111f_100%)] text-white"
    : "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_38%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-gray-900";
  const sidebar = dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-white/90";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";

  if (authChecking) {
    return <div className={`${shell} flex min-h-screen items-center justify-center text-sm`}>Prüfe Sitzung...</div>;
  }

  if (!me) {
    return (
      <LoginPage
        dark={dark}
        onToggleDark={() => setDark((value) => !value)}
        onLoggedIn={(session) => setMe({ username: session.username, displayName: session.displayName, role: session.role })}
      />
    );
  }

  const navItems = [
    { key: "dashboard" as const, icon: BarChart3, label: "Dashboard", adminOnly: false },
    { key: "lager" as const, icon: Package, label: "Bestände", adminOnly: true },
    { key: "katalog" as const, icon: BookOpen, label: "Katalog", adminOnly: true },
    { key: "bestellen" as const, icon: ShoppingBag, label: "Einkauf", adminOnly: true },
    { key: "wareneingang" as const, icon: Truck, label: "Wareneingang", adminOnly: true },
    { key: "verkauf" as const, icon: ShoppingCart, label: "Verkauf", adminOnly: false },
    { key: "lieferanten" as const, icon: Building2, label: "Lieferanten", adminOnly: true },
    { key: "reports" as const, icon: FileText, label: "Berichte", adminOnly: true },
    { key: "activity" as const, icon: ScrollText, label: "Aktivität", adminOnly: true },
    { key: "mitarbeiter" as const, icon: Users, label: "Mitarbeiter", adminOnly: true },
    { key: "einstellungen" as const, icon: SettingsIcon, label: "Einstellungen", adminOnly: false },
  ].filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className={shell}>
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-4 p-4 lg:p-6">
        <aside className={`hidden w-80 shrink-0 rounded-[2rem] border p-6 lg:flex lg:flex-col ${sidebar}`}>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-400">Buchhandlung · Lager · Verkauf</div>
            <h1 className="mt-3 text-[2rem] font-semibold leading-tight">Buchhandlungsverwaltung</h1>
            <p className={`mt-3 max-w-xs text-sm leading-6 ${mutedText}`}>Katalog, Lagerorte, Lieferanten, Einkauf und Verkauf in einer klaren Oberfläche.</p>
          </div>
          <nav className="mt-8 flex flex-col gap-2">
            {navItems.map((item) => (
              <MenuButton key={item.key} icon={item.icon} active={page === item.key} onClick={() => setPage(item.key)}>
                {item.label}
              </MenuButton>
            ))}
          </nav>
          <div className={`mt-auto rounded-[1.75rem] border p-5 ${dark ? "border-gray-800 bg-gray-900/80" : "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{me.displayName}</div>
                <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${dark ? "bg-gray-800 text-gray-300" : "bg-gray-200 text-gray-600"}`}>
                  {me.role === "admin" ? "Admin" : "Kasse"}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-11 px-4" onClick={() => setDark((value) => !value)}>
                {dark ? <Sun size={15} className="mr-2" /> : <Moon size={15} className="mr-2" />}
                {dark ? "Hell" : "Dunkel"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-11 px-4"
                onClick={() => {
                  setAuthToken(null);
                  setMe(null);
                }}
              >
                <LogOut size={15} className="mr-2" />
                Abmelden
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className={`flex items-center justify-between gap-4 p-4 ${topBarCard}`}>
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen((value) => !value)}>
                <Menu size={18} />
              </Button>
              <div className="min-w-0">
                <div className="truncate text-xl font-semibold">{PAGE_TITLES[page]}</div>
                <div className={`truncate text-sm ${mutedText}`}>{PAGE_DESCRIPTIONS[page]}</div>
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" onClick={() => setDark((value) => !value)}>
                {dark ? <Sun size={15} className="mr-2" /> : <Moon size={15} className="mr-2" />}
                {dark ? "Hell" : "Dunkel"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAuthToken(null);
                  setMe(null);
                }}
              >
                <LogOut size={15} className="mr-2" />
                Abmelden
              </Button>
            </div>
          </header>

          {mobileNavOpen ? (
            <div className={`grid gap-2 rounded-[2rem] border p-4 lg:hidden ${sidebar}`}>
              {navItems.map((item) => (
                <MenuButton
                  key={item.key}
                  icon={item.icon}
                  active={page === item.key}
                  onClick={() => {
                    setPage(item.key);
                    setMobileNavOpen(false);
                  }}
                >
                  {item.label}
                </MenuButton>
              ))}
            </div>
          ) : null}

          {dataError ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{dataError}</div> : null}

          {page === "dashboard" ? <DashboardPage card={card} stats={stats} loading={loadingData} salesOrders={salesOrders} /> : null}
          {page === "lager" ? (
            <InventoryPage
              card={card}
              dark={dark}
              settings={settings}
              products={products}
              stockEntries={stockEntries}
              ledgerEntries={ledgerEntries}
              warehouses={warehouses}
              loading={loadingData}
              error={dataError}
              reloadWarehouses={reloadWarehouses}
              reloadStockEntries={reloadStockEntries}
              reloadLedgerEntries={reloadLedgerEntries}
            />
          ) : null}
          {page === "katalog" ? (
            <CatalogPage
              card={card}
              dark={dark}
              products={products}
              suppliers={suppliers}
              reloadProducts={reloadProducts}
            />
          ) : null}
          {page === "bestellen" ? (
            <OrdersPage
              card={card}
              dark={dark}
              products={products}
              suppliers={suppliers}
              orders={orders}
              reloadOrders={reloadOrders}
            />
          ) : null}
          {page === "wareneingang" ? (
            <GoodsInPage
              card={card}
              dark={dark}
              orders={orders}
              warehouses={warehouses}
              reloadOrders={reloadOrders}
              reloadStockEntries={reloadStockEntries}
              reloadLedgerEntries={reloadLedgerEntries}
            />
          ) : null}
          {page === "verkauf" ? (
            <GoodsOutPage
              card={card}
              dark={dark}
              products={products}
              warehouses={warehouses}
              stockEntries={stockEntries}
              salesOrders={salesOrders}
              reloadStockEntries={reloadStockEntries}
              reloadLedgerEntries={reloadLedgerEntries}
              reloadSalesOrders={reloadSalesOrders}
            />
          ) : null}
          {page === "lieferanten" ? (
            <SuppliersPage card={card} dark={dark} suppliers={suppliers} reloadSuppliers={reloadSuppliers} />
          ) : null}
          {page === "reports" ? <ReportsPage card={card} dark={dark} onOpenDashboard={() => setPage("dashboard")} /> : null}
          {page === "activity" ? <ActivityLogPage card={card} dark={dark} /> : null}
          {page === "mitarbeiter" ? (
            <StaffUsersPage
              card={card}
              dark={dark}
              users={staffUsers}
              reloadUsers={reloadStaffUsers}
            />
          ) : null}
          {page === "einstellungen" ? <SettingsPage card={card} dark={dark} settings={settings} onChange={setSettings} /> : null}
        </div>
      </div>
    </div>
  );
}
