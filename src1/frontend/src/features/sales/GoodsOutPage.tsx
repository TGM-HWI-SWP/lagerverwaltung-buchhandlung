import { useMemo, useState } from "react";

import { apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CartLine, CatalogProduct, ReturnResponse, SaleOrder, SaleOrderLine, StockEntry, Warehouse } from "@/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface GoodsOutPageProps {
  card: string;
  dark: boolean;
  posMode?: boolean;
  /** Kept for API compatibility; product master data is not needed in POS render. */
  products: CatalogProduct[];
  warehouses: Warehouse[];
  stockEntries: StockEntry[];
  salesOrders: SaleOrder[];
  reloadStockEntries: () => Promise<void>;
  reloadLedgerEntries: () => Promise<void>;
  reloadSalesOrders: () => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoodsOutPage({
  card,
  dark,
  posMode = false,
  warehouses,
  stockEntries,
  salesOrders,
  reloadStockEntries,
  reloadLedgerEntries,
  reloadSalesOrders,
}: GoodsOutPageProps) {
  // ── POS & cart state ──────────────────────────────────────────────────────
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<"none" | "returns" | "history">("none");
  const [warehouseCode, setWarehouseCode] = useState("STORE");
  const [productSearch, setProductSearch] = useState("");
  const [customDiscountAmount, setCustomDiscountAmount] = useState("0");
  const [customDiscountType, setCustomDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [isFirstCustomer, setIsFirstCustomer] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Return flow state ─────────────────────────────────────────────────────
  const [returnOrderId, setReturnOrderId] = useState("");
  const [returnLineId, setReturnLineId] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("1");
  const [returnReason, setReturnReason] = useState("Retour");

  // ── Style tokens ──────────────────────────────────────────────────────────
  const inp = dark
    ? "w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-cyan-500"
    : "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-cyan-400";
  const mut = dark ? "text-gray-400" : "text-gray-500";
  const div = dark ? "border-gray-800" : "border-gray-200";
  const sideBg = dark ? "bg-gray-950" : "bg-white";
  const boardBg = dark ? "bg-[#080d17]" : "bg-gray-50";
  const tileBase = dark
    ? "border-gray-800 bg-gray-900/80 text-white hover:border-cyan-500/40 hover:bg-gray-900"
    : "border-gray-200 bg-white text-gray-900 hover:border-cyan-300 hover:bg-cyan-50/40";
  const tileOn = dark ? "border-cyan-400 bg-cyan-500/10 text-white" : "border-cyan-500 bg-cyan-50 text-gray-900";
  const kBtn = dark
    ? "rounded-2xl border border-gray-800 bg-gray-900/80 py-4 text-center text-xl font-semibold text-white transition hover:border-cyan-500/50 hover:bg-gray-900"
    : "rounded-2xl border border-gray-300 bg-white py-4 text-center text-xl font-semibold text-gray-900 transition hover:border-cyan-400 hover:bg-cyan-50";
  const ghostBtn = dark
    ? "rounded-2xl border border-gray-800 py-3 text-sm font-medium text-gray-300 transition hover:border-cyan-500/40 hover:text-white"
    : "rounded-2xl border border-gray-300 py-3 text-sm font-medium text-gray-600 transition hover:border-cyan-400 hover:text-gray-900";

  // ── Derived data ──────────────────────────────────────────────────────────
  const currentStock = useMemo(
    () =>
      stockEntries
        .filter((e) => e.warehouseCode === warehouseCode && e.onHand > 0)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [stockEntries, warehouseCode],
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return currentStock;
    return currentStock.filter((e) => [e.title, e.sku].some((v) => v.toLowerCase().includes(q)));
  }, [productSearch, currentStock]);

  const discountNum = Math.max(0, Number(customDiscountAmount) || 0);
  const cartSubtotal = cartLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const cartDiscount =
    customDiscountType === "FIXED"
      ? Math.min(discountNum, cartSubtotal)
      : cartSubtotal * (Math.min(discountNum, 100) / 100);
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount);
  const cartItemCount = cartLines.reduce((s, l) => s + l.quantity, 0);

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addToCart = (entry: StockEntry) => {
    setCartLines((prev) => {
      const existing = prev.find((l) => l.productId === entry.productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === entry.productId && l.quantity < l.availableStock
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      const line: CartLine = {
        productId: entry.productId,
        sku: entry.sku,
        title: entry.title,
        unitPrice: entry.sellingPrice,
        quantity: 1,
        availableStock: entry.onHand,
      };
      return [...prev, line];
    });
  };

  const updateLineQty = (productId: string, delta: number) => {
    setCartLines((prev) =>
      prev.map((l) =>
        l.productId === productId
          ? { ...l, quantity: Math.max(1, Math.min(l.quantity + delta, l.availableStock)) }
          : l,
      ),
    );
  };

  const removeLine = (productId: string) => {
    setCartLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const clearCart = () => {
    setCartLines([]);
    setCustomDiscountAmount("0");
    setIsFirstCustomer(false);
  };

  // ── API actions ───────────────────────────────────────────────────────────
  const createSale = async () => {
    if (cartLines.length === 0) {
      setStatusMessage("Bitte mindestens ein Produkt zum Warenkorb hinzufügen.");
      return;
    }
    setBusy(true);
    setStatusMessage(null);
    try {
      await apiPost("/sales-orders", {
        warehouse_code: warehouseCode,
        lines: cartLines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        is_first_customer: isFirstCustomer,
        custom_discount_amount: Math.max(0, Number(customDiscountAmount) || 0),
        custom_discount_type: customDiscountType,
      });
      clearCart();
      await Promise.all([reloadStockEntries(), reloadLedgerEntries(), reloadSalesOrders()]);
      setStatusMessage("✓ Verkauf gebucht");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Verkauf fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const createReturn = async () => {
    if (!returnOrderId || !returnLineId) {
      setStatusMessage("Bitte Verkaufsauftrag und Zeile für die Retoure wählen.");
      return;
    }
    setBusy(true);
    setStatusMessage(null);
    try {
      const response = await apiPost<
        ReturnResponse,
        { reason: string; lines: { sales_order_line_id: string; quantity: number }[] }
      >(`/sales-orders/${returnOrderId}/returns`, {
        reason: returnReason.trim() || "Retour",
        lines: [{ sales_order_line_id: returnLineId, quantity: Math.max(1, Number(returnQuantity) || 1) }],
      });
      await Promise.all([reloadStockEntries(), reloadLedgerEntries(), reloadSalesOrders()]);
      setStatusMessage(`✓ Retoure ${response.return_number} gebucht`);
      setActiveDrawer("none");
      setReturnOrderId("");
      setReturnLineId("");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Retoure fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  // ── Shared keypad helper ──────────────────────────────────────────────────
  const updateNumericField = (value: string, key: string, setter: (next: string) => void, minimum = 1) => {
    if (key === "del") {
      const next = value.slice(0, -1);
      setter(next === "" ? String(minimum) : next);
      return;
    }
    if (key === "clr") {
      setter(String(minimum));
      return;
    }
    const sanitized = value === "0" ? key : `${value}${key}`;
    setter(String(Math.max(minimum, Number(sanitized) || minimum)));
  };

  // ── QuantityKeypad ────────────────────────────────────────────────────────
  const QuantityKeypad = ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (next: string) => void;
    label: string;
  }) => (
    <div className="space-y-3">
      <div
        className={`rounded-2xl border px-4 py-3 text-center text-3xl font-semibold tracking-[0.2em] ${
          dark ? "border-gray-800 bg-gray-950 text-white" : "border-gray-200 bg-gray-50 text-gray-900"
        }`}
      >
        {String(Math.max(1, Number(value) || 1)).padStart(2, "0")}
      </div>
      <p className={`text-xs uppercase tracking-[0.18em] ${mut}`}>{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clr", "0", "del"].map((key) => (
          <button key={key} type="button" className={kBtn} onClick={() => updateNumericField(value, key, onChange)}>
            {key === "del" ? "←" : key === "clr" ? "C" : key}
          </button>
        ))}
      </div>
    </div>
  );

  // ── CartLineList ──────────────────────────────────────────────────────────
  const CartLineList = () => (
    <div className="flex-1 overflow-y-auto">
      {cartLines.length === 0 ? (
        <div
          className={`flex h-24 items-center justify-center rounded-2xl border border-dashed text-sm ${
            dark ? "border-gray-800 text-gray-600" : "border-gray-300 text-gray-400"
          }`}
        >
          Kein Artikel im Warenkorb
        </div>
      ) : (
        <div className="space-y-2">
          {cartLines.map((line) => (
            <div
              key={line.productId}
              className={`rounded-2xl border p-4 ${dark ? "border-gray-800 bg-gray-900/60" : "border-gray-200 bg-gray-50"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                      dark ? "bg-gray-800 text-gray-400" : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {line.sku}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{line.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.productId)}
                  className={`ml-1 mt-0.5 shrink-0 rounded-full p-1 text-xs transition ${
                    dark ? "text-gray-600 hover:bg-gray-800 hover:text-red-400" : "text-gray-400 hover:bg-gray-200 hover:text-red-500"
                  }`}
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateLineQty(line.productId, -1)}
                    className={`h-8 w-8 rounded-xl border text-base font-semibold transition ${
                      dark
                        ? "border-gray-700 bg-gray-900 text-white hover:border-cyan-500/50"
                        : "border-gray-300 bg-white text-gray-900 hover:border-cyan-400"
                    }`}
                  >
                    −
                  </button>
                  <span className={`w-7 text-center text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateLineQty(line.productId, +1)}
                    disabled={line.quantity >= line.availableStock}
                    className={`h-8 w-8 rounded-xl border text-base font-semibold transition disabled:opacity-30 ${
                      dark
                        ? "border-gray-700 bg-gray-900 text-white hover:border-cyan-500/50"
                        : "border-gray-300 bg-white text-gray-900 hover:border-cyan-400"
                    }`}
                  >
                    +
                  </button>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] uppercase tracking-widest ${mut}`}>
                    €{line.unitPrice.toFixed(2)}/Stk.
                  </div>
                  <div className="text-base font-semibold text-cyan-400">
                    €{(line.unitPrice * line.quantity).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── ReturnDrawer overlay ──────────────────────────────────────────────────
  const ReturnDrawer = () => {
    const returnOrder = salesOrders.find((o) => o.orderId === returnOrderId) ?? null;
    const selectedLine = returnOrder?.lines.find((l: SaleOrderLine) => l.lineId === returnLineId) ?? null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={() => setActiveDrawer("none")}
      >
        <div
          className={`relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[2rem] border p-8 shadow-2xl ${
            dark ? "border-gray-700 bg-gray-950" : "border-gray-200 bg-white"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Retoure</h2>
            <button type="button" onClick={() => setActiveDrawer("none")} className={`${dark ? "rounded-2xl border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-cyan-500/50 hover:text-white" : "rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-600 transition hover:border-cyan-400 hover:text-gray-900"}`}>
              Schließen
            </button>
          </div>
          <div className="mt-6 space-y-4">
            <select
              className={inp}
              value={returnOrderId}
              onChange={(e) => {
                setReturnOrderId(e.target.value);
                setReturnLineId("");
              }}
            >
              <option value="">Verkaufsauftrag wählen</option>
              {salesOrders.map((order) => (
                <option key={order.orderId} value={order.orderId}>
                  {order.orderNumber} · {order.warehouseCode} · €{order.total.toFixed(2)}
                </option>
              ))}
            </select>
            <select className={inp} value={returnLineId} onChange={(e) => setReturnLineId(e.target.value)}>
              <option value="">Verkaufszeile wählen</option>
              {(returnOrder?.lines ?? []).map((line: SaleOrderLine) => (
                <option key={line.lineId} value={line.lineId}>
                  {line.productName} · {line.quantity} Stk.
                </option>
              ))}
            </select>
            {selectedLine && (
              <div
                className={`rounded-2xl border p-4 ${dark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-gray-50"}`}
              >
                <div className={`text-xs uppercase tracking-widest ${mut}`}>Ausgewählte Position</div>
                <div className="mt-2 font-semibold">{selectedLine.productName}</div>
                <div className={`mt-1 text-sm ${mut}`}>
                  Max. {selectedLine.quantity} Stk. · €{selectedLine.unitPrice.toFixed(2)}/Stk.
                </div>
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <div className={`text-xs uppercase tracking-[0.18em] ${mut}`}>Retourgrund</div>
                <input
                  className={inp}
                  placeholder="z. B. Beschädigt"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>
              <div>
                <QuantityKeypad value={returnQuantity} onChange={setReturnQuantity} label="Retourmenge" />
              </div>
            </div>
            {statusMessage && (
              <div className={`text-sm ${statusMessage.startsWith("✓") ? "text-cyan-400" : "text-red-400"}`}>
                {statusMessage}
              </div>
            )}
            <Button
              className="h-14 w-full text-base font-semibold"
              onClick={createReturn}
              disabled={busy || !returnOrderId || !returnLineId}
            >
              {busy ? "Retoure wird gebucht..." : "Retoure jetzt buchen"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ── SalesHistoryDrawer overlay ────────────────────────────────────────────
  const SalesHistoryDrawer = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setActiveDrawer("none")}
    >
      <div
        className={`relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[2rem] border p-8 shadow-2xl ${
          dark ? "border-gray-700 bg-gray-950" : "border-gray-200 bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">Letzte Verkäufe</h2>
          <button
            type="button"
            onClick={() => setActiveDrawer("none")}
            className={`${dark ? "rounded-2xl border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-cyan-500/50 hover:text-white" : "rounded-2xl border border-gray-300 px-4 py-2 text-sm text-gray-600 transition hover:border-cyan-400 hover:text-gray-900"}`}
          >
            Schließen
          </button>
        </div>
        <div className="mt-6 space-y-3">
          {salesOrders.length === 0 ? (
            <div
              className={`rounded-2xl border p-6 text-sm ${dark ? "border-gray-800 text-gray-500" : "border-gray-200 text-gray-500"}`}
            >
              Noch keine Verkäufe vorhanden.
            </div>
          ) : (
            salesOrders.slice(0, 20).map((order) => (
              <button
                key={order.orderId}
                type="button"
                onClick={() => {
                  setReturnOrderId(order.orderId);
                  setReturnLineId(order.lines[0]?.lineId ?? "");
                  setActiveDrawer("returns");
                }}
                className={`w-full rounded-[1.4rem] border p-5 text-left transition ${
                  dark
                    ? "border-gray-800 bg-gray-900/60 hover:border-cyan-500/40"
                    : "border-gray-200 bg-gray-50 hover:border-cyan-300"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{order.orderNumber}</div>
                    <div className={`mt-1 text-sm ${mut}`}>
                      {order.warehouseCode} ·{" "}
                      {new Date(order.createdAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs uppercase tracking-widest ${mut}`}>Gesamt</div>
                    <div className="mt-1 text-xl font-semibold text-cyan-400">€{order.total.toFixed(2)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.lines.map((line: SaleOrderLine) => (
                    <div
                      key={line.lineId}
                      className={`rounded-xl px-3 py-1.5 text-xs ${dark ? "bg-gray-800 text-gray-300" : "bg-gray-200 text-gray-700"}`}
                    >
                      {line.productName} · {line.quantity} Stk.
                    </div>
                  ))}
                </div>
                <div className={`mt-3 text-xs ${mut}`}>Antippen → direkt für Retoure übernehmen</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // ── POS Mode render ───────────────────────────────────────────────────────
  if (posMode) {
    return (
      <div
        className={`flex flex-1 overflow-hidden rounded-[2rem] border ${dark ? "border-gray-800" : "border-gray-200"}`}
      >
        {/* Overlays */}
        {activeDrawer === "returns" && <ReturnDrawer />}
        {activeDrawer === "history" && <SalesHistoryDrawer />}

        {/* ── Left: POS Sidebar ─────────────────────────────────────────── */}
        <aside
          className={`flex w-[340px] shrink-0 flex-col border-r xl:w-[380px] ${sideBg} ${div}`}
        >
          {/* Warehouse selector */}
          <div className={`shrink-0 border-b p-5 ${div}`}>
            <div className={`mb-2 text-xs uppercase tracking-[0.18em] ${mut}`}>Lagerort</div>
            <select
              className={`${inp} h-12`}
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.code}>
                  {wh.code} · {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cart lines – scrollable middle section */}
          <div className="flex flex-1 flex-col gap-3 overflow-hidden p-5">
            <div className="flex shrink-0 items-center justify-between">
              <div className={`text-xs uppercase tracking-[0.18em] ${mut}`}>
                Warenkorb
                {cartLines.length > 0 && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                      dark ? "bg-cyan-500/20 text-cyan-300" : "bg-cyan-100 text-cyan-700"
                    }`}
                  >
                    {cartLines.length}
                  </span>
                )}
              </div>
              {cartLines.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className={`text-xs transition ${dark ? "text-gray-600 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}
                >
                  Leeren
                </button>
              )}
            </div>
            <CartLineList />
          </div>

          {/* Discount & first-customer */}
          <div className={`shrink-0 space-y-3 border-t p-5 ${div}`}>
            <div className={`text-xs uppercase tracking-[0.18em] ${mut}`}>Rabatt</div>
            <div className="flex gap-2">
              <div className={`inline-flex rounded-2xl border p-1 ${dark ? "border-gray-800" : "border-gray-200"}`}>
                <button
                  type="button"
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                    customDiscountType === "FIXED" ? "bg-cyan-500 text-slate-950" : mut
                  }`}
                  onClick={() => setCustomDiscountType("FIXED")}
                >
                  €
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                    customDiscountType === "PERCENT" ? "bg-cyan-500 text-slate-950" : mut
                  }`}
                  onClick={() => setCustomDiscountType("PERCENT")}
                >
                  %
                </button>
              </div>
              <input
                className={`${inp} h-10 flex-1`}
                inputMode="decimal"
                placeholder={customDiscountType === "PERCENT" ? "z. B. 10" : "z. B. 2.50"}
                value={customDiscountAmount}
                onChange={(e) => setCustomDiscountAmount(e.target.value)}
              />
            </div>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                dark ? "border-gray-800 bg-gray-900/60 text-gray-200" : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={isFirstCustomer}
                onChange={(e) => setIsFirstCustomer(e.target.checked)}
              />
              Erstkunde-Rabatt
            </label>
          </div>

          {/* Totals */}
          <div className={`shrink-0 border-t p-5 ${div}`}>
            <div className="space-y-2">
              <div className={`flex justify-between text-sm ${mut}`}>
                <span>Zwischensumme</span>
                <span>€{cartSubtotal.toFixed(2)}</span>
              </div>
              {cartDiscount > 0 && (
                <div className="flex justify-between text-sm text-cyan-400">
                  <span>Rabatt</span>
                  <span>−€{cartDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className={`flex items-end justify-between border-t pt-3 ${div}`}>
                <span className={`text-sm font-medium ${mut}`}>Gesamtbetrag</span>
                <span className="text-2xl font-bold text-cyan-400">€{cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Status message */}
          {statusMessage && (
            <div
              className={`shrink-0 border-t px-5 py-3 text-sm ${div} ${
                statusMessage.startsWith("✓") ? "text-cyan-400" : "text-red-400"
              }`}
            >
              {statusMessage}
            </div>
          )}

          {/* Primary action + drawer triggers */}
          <div className={`shrink-0 space-y-2 border-t p-5 ${div}`}>
            <Button
              className="h-14 w-full text-base font-semibold"
              onClick={createSale}
              disabled={busy || cartLines.length === 0}
            >
              {busy
                ? "Wird gebucht..."
                : cartLines.length === 0
                  ? "← Artikel auswählen"
                  : `${cartItemCount} Artikel · €${cartTotal.toFixed(2)} · Verkaufen`}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={ghostBtn} onClick={() => setActiveDrawer("returns")}>
                Retoure
              </button>
              <button type="button" className={ghostBtn} onClick={() => setActiveDrawer("history")}>
                Letzte Verkäufe
              </button>
            </div>
          </div>
        </aside>

        {/* ── Right: Product Board ───────────────────────────────────────── */}
        <div className={`flex flex-1 flex-col overflow-hidden ${boardBg}`}>
          {/* Search bar */}
          <div className={`shrink-0 border-b p-5 ${dark ? "border-gray-800" : "border-gray-200"}`}>
            <div className="flex items-center gap-3">
              <input
                className={`${inp} h-12 flex-1`}
                placeholder="Artikel nach Titel oder SKU suchen …"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch("")}
                  className={`h-12 rounded-2xl border px-5 text-sm font-medium transition ${
                    dark
                      ? "border-gray-800 text-gray-300 hover:border-cyan-500/40 hover:text-white"
                      : "border-gray-300 text-gray-600 hover:border-cyan-400"
                  }`}
                >
                  Leeren
                </button>
              )}
              <div
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${
                  dark ? "bg-gray-900 text-gray-400" : "bg-gray-100 text-gray-500"
                }`}
              >
                {currentStock.length} Artikel
              </div>
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {filteredProducts.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredProducts.map((entry) => {
                  const inCart = cartLines.some((l) => l.productId === entry.productId);
                  const cartQty = cartLines.find((l) => l.productId === entry.productId)?.quantity ?? 0;
                  return (
                    <button
                      key={entry.productId}
                      type="button"
                      onClick={() => addToCart(entry)}
                      className={`min-h-[160px] rounded-[1.6rem] border p-5 text-left transition ${inCart ? tileOn : tileBase}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                            dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {entry.sku}
                        </div>
                        {inCart && (
                          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-slate-950">
                            {cartQty}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 line-clamp-3 min-h-[4rem] text-base font-semibold leading-6">
                        {entry.title}
                      </div>
                      <div className={`mt-3 flex items-end justify-between gap-2 ${mut}`}>
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em]">Bestand</div>
                          <div className="mt-0.5 text-sm font-semibold">{entry.onHand} Stk.</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-[0.18em]">Preis</div>
                          <div className="mt-0.5 text-lg font-semibold text-cyan-400">
                            €{entry.sellingPrice.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                className={`flex items-center justify-center rounded-[1.6rem] border p-8 text-sm ${
                  dark ? "border-gray-800 text-gray-500" : "border-gray-200 text-gray-500"
                }`}
              >
                {productSearch
                  ? `Keine Artikel für „${productSearch}" gefunden.`
                  : "Keine Artikel mit Bestand in diesem Lagerort."}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Non-POS (admin) render ────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full">
      <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left: Checkout panel */}
        <Card className={card}>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold">Kasse</h2>
            <p className={`mt-1 text-sm ${mut}`}>Einzelner oder mehrzeiliger Verkauf buchen.</p>

            <div className="mt-6 space-y-4">
              <select className={inp} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)}>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.code}>
                    {wh.code} · {wh.name}
                  </option>
                ))}
              </select>

              <CartLineList />

              {/* Discount */}
              <div
                className={`rounded-[1.6rem] border p-4 ${dark ? "border-gray-800 bg-gray-950/70" : "border-gray-200 bg-gray-50"}`}
              >
                <div className={`mb-3 text-xs uppercase tracking-[0.18em] ${mut}`}>Rabatt</div>
                <div className="flex items-center gap-2">
                  <div className={`inline-flex rounded-2xl border p-1 ${dark ? "border-gray-800" : "border-gray-200"}`}>
                    <button
                      type="button"
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                        customDiscountType === "FIXED" ? "bg-cyan-500 text-slate-950" : mut
                      }`}
                      onClick={() => setCustomDiscountType("FIXED")}
                    >
                      €
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                        customDiscountType === "PERCENT" ? "bg-cyan-500 text-slate-950" : mut
                      }`}
                      onClick={() => setCustomDiscountType("PERCENT")}
                    >
                      %
                    </button>
                  </div>
                  <input
                    className={`${inp} flex-1`}
                    inputMode="decimal"
                    placeholder="Rabatt"
                    value={customDiscountAmount}
                    onChange={(e) => setCustomDiscountAmount(e.target.value)}
                  />
                </div>
              </div>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                  dark ? "border-gray-800 bg-gray-950/70 text-gray-200" : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isFirstCustomer}
                  onChange={(e) => setIsFirstCustomer(e.target.checked)}
                />
                Erstkunde-Rabatt berücksichtigen
              </label>

              {cartLines.length > 0 && (
                <div className={`flex justify-between text-sm ${mut}`}>
                  <span>Summe</span>
                  <span className="font-semibold text-cyan-400">€{cartTotal.toFixed(2)}</span>
                </div>
              )}

              <Button onClick={createSale} disabled={busy || cartLines.length === 0}>
                {busy
                  ? "Wird gebucht..."
                  : cartLines.length === 0
                    ? "Produkt rechts auswählen"
                    : `${cartItemCount} Artikel verkaufen · €${cartTotal.toFixed(2)}`}
              </Button>

              {statusMessage && (
                <div className={`text-sm ${statusMessage.startsWith("✓") ? "text-cyan-400" : "text-red-400"}`}>
                  {statusMessage}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Product grid + Returns */}
        <div className="space-y-6">
          <Card className={card}>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold">Artikelwahl</h2>
              <div className="mt-4 flex gap-3">
                <input
                  className={`${inp} flex-1`}
                  placeholder="Suchen …"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {productSearch && (
                  <button
                    type="button"
                    className={`rounded-2xl border px-4 py-2 text-sm transition ${
                      dark
                        ? "border-gray-800 text-gray-300 hover:border-cyan-500/40"
                        : "border-gray-300 text-gray-600 hover:border-cyan-400"
                    }`}
                    onClick={() => setProductSearch("")}
                  >
                    Leeren
                  </button>
                )}
              </div>
              {filteredProducts.length > 0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.slice(0, 12).map((entry) => {
                    const inCart = cartLines.some((l) => l.productId === entry.productId);
                    const cartQty = cartLines.find((l) => l.productId === entry.productId)?.quantity ?? 0;
                    return (
                      <button
                        key={entry.productId}
                        type="button"
                        onClick={() => addToCart(entry)}
                        className={`min-h-[140px] rounded-[1.6rem] border p-5 text-left transition ${inCart ? tileOn : tileBase}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                              dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {entry.sku}
                          </div>
                          {inCart && (
                            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-slate-950">
                              {cartQty}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{entry.title}</div>
                        <div className={`mt-3 flex items-end justify-between text-xs ${mut}`}>
                          <span>{entry.onHand} Stk.</span>
                          <span className="text-base font-semibold text-cyan-400">€{entry.sellingPrice.toFixed(2)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`mt-5 rounded-[1.6rem] border p-6 text-sm ${
                    dark ? "border-gray-800 text-gray-500" : "border-gray-200 text-gray-500"
                  }`}
                >
                  {productSearch ? `Keine Artikel für „${productSearch}" gefunden.` : "Keine Artikel mit Bestand."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Returns – always visible in admin mode */}
          <Card className={card}>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold">Retoure</h2>
              <div className="mt-5 space-y-4">
                <select
                  className={inp}
                  value={returnOrderId}
                  onChange={(e) => {
                    setReturnOrderId(e.target.value);
                    setReturnLineId("");
                  }}
                >
                  <option value="">Verkaufsauftrag wählen</option>
                  {salesOrders.map((o) => (
                    <option key={o.orderId} value={o.orderId}>
                      {o.orderNumber} · €{o.total.toFixed(2)}
                    </option>
                  ))}
                </select>
                <select className={inp} value={returnLineId} onChange={(e) => setReturnLineId(e.target.value)}>
                  <option value="">Zeile wählen</option>
                  {(salesOrders.find((o) => o.orderId === returnOrderId)?.lines ?? []).map((line: SaleOrderLine) => (
                    <option key={line.lineId} value={line.lineId}>
                      {line.productName} · {line.quantity} Stk.
                    </option>
                  ))}
                </select>
                <input
                  className={inp}
                  placeholder="Retourgrund"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
                <div className="flex items-center gap-3">
                  <label className={`text-sm ${mut}`}>Menge</label>
                  <input
                    type="number"
                    min={1}
                    className={`${inp} w-28`}
                    value={returnQuantity}
                    onChange={(e) => setReturnQuantity(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={createReturn}
                  disabled={busy || !returnOrderId || !returnLineId}
                >
                  {busy ? "Wird gebucht..." : "Retoure buchen"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
