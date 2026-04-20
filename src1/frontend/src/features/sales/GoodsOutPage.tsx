import { useMemo, useState } from "react";

import { apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CatalogProduct, ReturnResponse, SaleOrder, StockEntry, Warehouse } from "@/types";

interface GoodsOutPageProps {
  card: string;
  dark: boolean;
  posMode?: boolean;
  products: CatalogProduct[];
  warehouses: Warehouse[];
  stockEntries: StockEntry[];
  salesOrders: SaleOrder[];
  reloadStockEntries: () => Promise<void>;
  reloadLedgerEntries: () => Promise<void>;
  reloadSalesOrders: () => Promise<void>;
}

export function GoodsOutPage({
  card,
  dark,
  posMode = false,
  products,
  warehouses,
  stockEntries,
  salesOrders,
  reloadStockEntries,
  reloadLedgerEntries,
  reloadSalesOrders,
}: GoodsOutPageProps) {
  const [warehouseCode, setWarehouseCode] = useState("STORE");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customDiscountAmount, setCustomDiscountAmount] = useState("0");
  const [customDiscountType, setCustomDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [isFirstCustomer, setIsFirstCustomer] = useState(false);
  const [salesTab, setSalesTab] = useState<"sale" | "returns" | "history">("sale");
  const [returnOrderId, setReturnOrderId] = useState("");
  const [returnLineId, setReturnLineId] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("1");
  const [returnReason, setReturnReason] = useState("Retour");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputClass = dark
    ? "w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const posCard = dark
    ? "rounded-[2rem] border border-cyan-500/10 bg-gray-900/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "rounded-[2rem] border border-cyan-100 bg-white shadow-sm";
  const smallButtonClass = dark
    ? "rounded-2xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-sm font-medium text-gray-200 transition hover:border-cyan-500/40 hover:text-white"
    : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-cyan-400 hover:text-gray-900";
  const keypadButtonClass = dark
    ? "rounded-2xl border border-gray-800 bg-gray-950/80 px-4 py-5 text-center text-2xl font-semibold text-white transition hover:border-cyan-500/50 hover:bg-gray-900"
    : "rounded-2xl border border-gray-300 bg-white px-4 py-5 text-center text-2xl font-semibold text-gray-900 transition hover:border-cyan-400 hover:bg-cyan-50";
  const currentStock = stockEntries.filter((entry) => entry.warehouseCode === warehouseCode);
  const selectableProducts = useMemo(
    () => currentStock.filter((entry) => entry.onHand > 0).sort((a, b) => a.title.localeCompare(b.title)),
    [currentStock],
  );
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return selectableProducts;
    return selectableProducts.filter((entry) =>
      [entry.title, entry.sku, entry.warehouseCode].some((value) => value.toLowerCase().includes(query))
    );
  }, [productSearch, selectableProducts]);
  const selectedStock = selectableProducts.find((entry) => entry.productId === productId) ?? null;
  const selectedProduct = products.find((entry) => entry.id === productId) ?? null;
  const selectedQuantity = Math.max(1, Number(quantity) || 1);
  const returnSelectedQuantity = Math.max(1, Number(returnQuantity) || 1);
  const selectedLine = salesOrders.find((order) => order.orderId === returnOrderId)?.lines.find((line) => line.lineId === returnLineId) ?? null;
  const selectedTotal = selectedStock ? selectedStock.sellingPrice * selectedQuantity : 0;
  const productGrid = filteredProducts.slice(0, posMode ? 32 : 12);
  const currentOrder = salesOrders.find((order) => order.orderId === returnOrderId) ?? null;
  const totalAvailable = selectableProducts.reduce((sum, entry) => sum + entry.onHand, 0);

  const createSale = async () => {
    if (!selectedStock || !selectedProduct) {
      setStatusMessage("Bitte Produkt und Lagerort auswählen.");
      return;
    }
    setBusy(true);
    setStatusMessage(null);
    try {
      await apiPost("/sales-orders", {
        warehouse_code: warehouseCode,
        lines: [{ product_id: selectedProduct.id, quantity: Math.max(1, Number(quantity) || 1) }],
        is_first_customer: isFirstCustomer,
        custom_discount_amount: Math.max(0, Number(customDiscountAmount) || 0),
        custom_discount_type: customDiscountType,
      });
      setQuantity("1");
      setCustomDiscountAmount("0");
      setCustomDiscountType("FIXED");
      setIsFirstCustomer(false);
      await Promise.all([reloadStockEntries(), reloadLedgerEntries(), reloadSalesOrders()]);
      setStatusMessage("Verkauf wurde gebucht.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Verkauf fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const createReturn = async () => {
    if (!returnOrderId || !returnLineId) {
      setStatusMessage("Bitte zuerst eine Verkaufsposition für die Retoure wählen.");
      return;
    }
    setBusy(true);
    setStatusMessage(null);
    try {
      const response = await apiPost<ReturnResponse, { reason: string; lines: { sales_order_line_id: string; quantity: number }[] }>(
        `/sales-orders/${returnOrderId}/returns`,
        {
          reason: returnReason.trim() || "Retour",
          lines: [{ sales_order_line_id: returnLineId, quantity: Math.max(1, Number(returnQuantity) || 1) }],
        },
      );
      await Promise.all([reloadStockEntries(), reloadLedgerEntries(), reloadSalesOrders()]);
      setStatusMessage(`Retoure ${response.return_number} wurde gebucht.`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Retoure fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const updateNumericField = (
    value: string,
    key: string,
    setter: (next: string) => void,
    minimum = 1,
  ) => {
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
      <div className={`rounded-2xl border px-4 py-4 text-center text-4xl font-semibold tracking-[0.22em] ${dark ? "border-gray-800 bg-gray-950 text-white" : "border-gray-200 bg-gray-50 text-gray-900"}`}>
        {String(Math.max(1, Number(value) || 1)).padStart(2, "0")}
      </div>
      <p className={`text-xs uppercase tracking-[0.18em] ${mutedText}`}>{label}</p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clr", "0", "del"].map((key) => (
          <button
            key={key}
            type="button"
            className={keypadButtonClass}
            onClick={() => updateNumericField(value, key, onChange)}
          >
            {key === "del" ? "←" : key === "clr" ? "C" : key}
          </button>
        ))}
      </div>
    </div>
  );

  const ProductTile = ({ entry }: { entry: StockEntry }) => {
    const active = entry.productId === productId;
    return (
      <button
        type="button"
        onClick={() => setProductId(entry.productId)}
        className={`min-h-[170px] rounded-[1.6rem] border p-5 text-left transition ${
          active
            ? dark
              ? "border-cyan-400 bg-cyan-500/10 text-white"
              : "border-cyan-500 bg-cyan-50 text-gray-900"
            : dark
              ? "border-gray-800 bg-gray-950/80 text-white hover:border-cyan-500/40"
              : "border-gray-200 bg-white text-gray-900 hover:border-cyan-300"
        }`}
      >
        <div className={`inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${dark ? "bg-gray-900 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
          {entry.sku}
        </div>
        <div className="mt-4 line-clamp-3 min-h-[4.5rem] text-lg font-semibold leading-7">{entry.title}</div>
        <div className={`mt-3 flex items-end justify-between gap-3 ${mutedText}`}>
          <div>
            <div className="text-xs uppercase tracking-[0.18em]">Bestand</div>
            <div className="mt-1 text-base font-semibold">{entry.onHand} Stk.</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.18em]">Preis</div>
            <div className="mt-1 text-xl font-semibold text-cyan-400">€{entry.sellingPrice.toFixed(2)}</div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className={`mx-auto w-full ${posMode ? "max-w-[1700px]" : ""}`}>
      <div className={`grid items-start gap-6 ${posMode ? "xl:grid-cols-[380px_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"}`}>
      <Card className={`${posMode ? `${posCard} xl:sticky xl:top-6` : card}`}>
        <CardContent className={`${posMode ? "p-7" : "p-6"}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={`${posMode ? "text-2xl" : "text-xl"} font-semibold`}>Kasse</h2>
              <p className={`mt-1 text-sm ${mutedText}`}>Schnellverkauf mit großen Touch-Flächen und direktem Lagerzugriff.</p>
            </div>
            {selectedStock ? (
              <div className={`rounded-2xl border px-4 py-3 text-right ${dark ? "border-gray-800 bg-gray-950" : "border-gray-200 bg-gray-50"}`}>
                <div className={`text-xs uppercase tracking-[0.18em] ${mutedText}`}>Summe</div>
                <div className="mt-1 text-3xl font-semibold text-cyan-400">€{selectedTotal.toFixed(2)}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            <select className={`${inputClass} ${posMode ? "h-16 text-base" : ""}`} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.code}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
            </select>

              <div className={`rounded-[1.6rem] border p-5 ${dark ? "border-gray-800 bg-gray-950/70" : "border-gray-200 bg-gray-50"}`}>
                <div className={`text-xs uppercase tracking-[0.18em] ${mutedText}`}>Aktueller Artikel</div>
                <div className="mt-3 text-2xl font-semibold">{selectedStock?.title || "Noch kein Produkt ausgewählt"}</div>
                <div className={`mt-3 flex flex-wrap gap-3 text-sm ${mutedText}`}>
                  <span>Bestand: {selectedStock?.onHand ?? 0} Stk.</span>
                  <span>Einzelpreis: €{selectedStock?.sellingPrice.toFixed(2) ?? "0.00"}</span>
                  <span>Menge: {selectedQuantity}</span>
                </div>
              </div>

              <div className="grid gap-4">
                <QuantityKeypad value={quantity} onChange={setQuantity} label="Menge" />
              <div className={`rounded-[1.6rem] border p-4 ${dark ? "border-gray-800 bg-gray-950/70" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={`text-xs uppercase tracking-[0.18em] ${mutedText}`}>Eigener Rabatt</div>
                    <div className={`mt-1 text-sm ${mutedText}`}>Wahlweise direkt in Euro oder in Prozent vom aktuellen Verkauf.</div>
                  </div>
                  <div className="inline-flex rounded-2xl border p-1">
                    <button
                      type="button"
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${customDiscountType === "FIXED" ? "bg-cyan-500 text-slate-950" : mutedText}`}
                      onClick={() => setCustomDiscountType("FIXED")}
                    >
                      Rabatt €
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${customDiscountType === "PERCENT" ? "bg-cyan-500 text-slate-950" : mutedText}`}
                      onClick={() => setCustomDiscountType("PERCENT")}
                    >
                      Rabatt %
                    </button>
                  </div>
                </div>
                <input
                  className={`${inputClass} ${posMode ? "mt-4 h-14 text-base" : "mt-4"}`}
                  inputMode="decimal"
                  placeholder={customDiscountType === "PERCENT" ? "z. B. 10 für 10 %" : "z. B. 2.50 für 2,50 €"}
                  value={customDiscountAmount}
                  onChange={(e) => setCustomDiscountAmount(e.target.value)}
                />
              </div>
              <label className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-sm ${dark ? "border-gray-800 bg-gray-950/70 text-gray-200" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                <input type="checkbox" checked={isFirstCustomer} onChange={(e) => setIsFirstCustomer(e.target.checked)} />
                Erstkunde-Rabatt zusätzlich berücksichtigen
              </label>
              <Button className={`${posMode ? "h-16 text-lg font-semibold" : ""}`} onClick={createSale} disabled={busy || !selectedStock}>
                {busy ? "Verkauf wird gebucht..." : selectedStock ? `Jetzt ${selectedQuantity} Artikel verkaufen` : "Zuerst rechts ein Produkt auswählen"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className={posMode ? posCard : card}>
          <CardContent className={`${posMode ? "p-7" : "p-6"}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className={`${posMode ? "text-2xl" : "text-xl"} font-semibold`}>Artikelwahl</h2>
                <p className={`mt-1 text-sm ${mutedText}`}>Das Produktboard ist die Hauptfläche. Service-Funktionen wie Retoure und Verlauf liegen separat, damit der Verkauf nicht blockiert wird.</p>
              </div>
              <div className={`rounded-full px-4 py-2 text-sm ${dark ? "bg-gray-950 text-gray-300" : "bg-gray-50 text-gray-600"}`}>
                {warehouseCode} · {selectableProducts.length} Artikel · {totalAvailable} Stk.
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-2xl border p-1">
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${salesTab === "sale" ? "bg-cyan-500 text-slate-950" : mutedText}`}
                  onClick={() => setSalesTab("sale")}
                >
                  Verkauf
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${salesTab === "returns" ? "bg-cyan-500 text-slate-950" : mutedText}`}
                  onClick={() => setSalesTab("returns")}
                >
                  Retoure
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${salesTab === "history" ? "bg-cyan-500 text-slate-950" : mutedText}`}
                  onClick={() => setSalesTab("history")}
                >
                  Letzte Verkäufe
                </button>
              </div>
              {statusMessage ? <div className="text-sm text-cyan-400">{statusMessage}</div> : null}
            </div>
            <div className={`mt-5 grid gap-3 ${posMode ? "lg:grid-cols-[minmax(0,1fr)_190px]" : ""}`}>
              <input
                className={`${inputClass} ${posMode ? "h-16 text-base" : ""}`}
                placeholder="Produkte nach Titel oder SKU suchen"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <button type="button" className={smallButtonClass} onClick={() => setProductSearch("")}>
                Suche leeren
              </button>
            </div>
            {productGrid.length ? (
              <div className={`mt-6 grid gap-4 ${posMode ? "min-h-[580px] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"}`}>
                {productGrid.map((entry) => (
                  <ProductTile key={entry.productId} entry={entry} />
                ))}
              </div>
            ) : (
              <div className={`mt-6 flex min-h-[580px] items-center justify-center rounded-[1.6rem] border p-6 text-sm ${dark ? "border-gray-800 bg-gray-950/70 text-gray-300" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
                <div className="max-w-md text-center">
                  <div className="text-lg font-semibold text-white dark:text-white">Keine Produkte für diese Suche gefunden</div>
                  <div className={`mt-2 ${mutedText}`}>Wähle links einen Lagerort oder suche nach Titel und SKU. In der finalen Kassenansicht sollen hier die großen antippbaren Produktkacheln sitzen.</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={posMode ? `${posCard} ${salesTab === "sale" ? "hidden" : ""}` : card}>
          <CardContent className={`${posMode ? "p-7" : "p-6"}`}>
            {salesTab === "returns" ? (
              <div className={`mt-6 grid gap-6 ${posMode ? "2xl:grid-cols-[minmax(0,1.15fr)_360px]" : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"}`}>
                <Card className={dark ? "border-gray-800 bg-gray-950/50" : "border-gray-200 bg-gray-50"}>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold">Retoure</h2>
                    <p className={`mt-1 text-sm ${mutedText}`}>Wähle einen bisherigen Verkauf und buche die Rücknahme direkt über Touch-Menge.</p>
                    <div className="mt-5 space-y-4">
                      <select className={`${inputClass} ${posMode ? "h-16 text-base" : ""}`} value={returnOrderId} onChange={(e) => { setReturnOrderId(e.target.value); setReturnLineId(""); }}>
                        <option value="">Verkaufsauftrag wählen</option>
                        {salesOrders.map((order) => (
                          <option key={order.orderId} value={order.orderId}>
                            {order.orderNumber} · {order.warehouseCode} · €{order.total.toFixed(2)}
                          </option>
                        ))}
                      </select>
                      <select className={`${inputClass} ${posMode ? "h-16 text-base" : ""}`} value={returnLineId} onChange={(e) => setReturnLineId(e.target.value)}>
                        <option value="">Verkaufszeile wählen</option>
                        {(salesOrders.find((order) => order.orderId === returnOrderId)?.lines ?? []).map((line) => (
                          <option key={line.lineId} value={line.lineId}>
                            {line.productName} · {line.quantity} Stk.
                          </option>
                        ))}
                      </select>
                      <div className={`rounded-[1.6rem] border p-5 ${dark ? "border-gray-800 bg-gray-950/70" : "border-gray-200 bg-white"}`}>
                        <div className={`text-xs uppercase tracking-[0.18em] ${mutedText}`}>Retoure-Artikel</div>
                        <div className="mt-3 text-xl font-semibold">{selectedLine?.productName || "Noch keine Verkaufszeile ausgewählt"}</div>
                        <div className={`mt-2 text-sm ${mutedText}`}>Menge: {returnSelectedQuantity} · Grund: {returnReason}</div>
                      </div>
                      <input className={`${inputClass} ${posMode ? "h-14 text-base" : ""}`} placeholder="Retourgrund" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
                      <Button variant="outline" className={`${posMode ? "h-16 text-lg font-semibold" : ""}`} onClick={createReturn} disabled={busy || !returnOrderId || !returnLineId}>
                        {busy ? "Retoure wird gebucht..." : "Retoure jetzt buchen"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`${dark ? "border-gray-800 bg-gray-950/50" : "border-gray-200 bg-gray-50"} ${posMode ? "2xl:max-w-[360px]" : ""}`}>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold">Touch-Retoure</h3>
                    <div className="mt-5">
                      <QuantityKeypad value={returnQuantity} onChange={setReturnQuantity} label="Retourmenge" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {salesTab === "history" ? (
              <div className="mt-6 space-y-4">
                {salesOrders.length ? (
                  salesOrders.slice(0, posMode ? 16 : 8).map((order) => (
                    <button
                      key={order.orderId}
                      type="button"
                      onClick={() => {
                        setReturnOrderId(order.orderId);
                        setReturnLineId(order.lines[0]?.lineId ?? "");
                        setSalesTab("returns");
                      }}
                      className={`w-full rounded-[1.6rem] border p-5 text-left transition ${dark ? "border-gray-800 bg-gray-950/70 hover:border-cyan-500/40" : "border-gray-200 bg-gray-50 hover:border-cyan-300"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-lg font-semibold">{order.orderNumber}</div>
                          <div className={`mt-1 text-sm ${mutedText}`}>
                            {order.warehouseCode} · {new Date(order.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs uppercase tracking-[0.18em] ${mutedText}`}>Gesamt</div>
                          <div className="mt-1 text-2xl font-semibold text-cyan-400">€{order.total.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className={`mt-4 grid gap-2 ${posMode ? "lg:grid-cols-2" : ""}`}>
                        {order.lines.map((line) => (
                          <div key={line.lineId} className={`rounded-2xl px-4 py-3 text-sm ${dark ? "bg-gray-900 text-gray-300" : "bg-white text-gray-700"}`}>
                            <span className="font-medium text-white dark:text-white">{line.productName}</span>
                            <span className={`ml-2 ${mutedText}`}>{line.quantity} Stk. · €{line.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className={`mt-4 text-sm ${mutedText}`}>Antippen, um diesen Verkauf direkt für eine Retoure zu übernehmen.</div>
                    </button>
                  ))
                ) : (
                  <div className={`rounded-[1.6rem] border p-6 text-sm ${dark ? "border-gray-800 bg-gray-950/70 text-gray-300" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
                    Noch keine Verkäufe vorhanden.
                  </div>
                )}
                {currentOrder ? (
                  <div className={`rounded-[1.6rem] border p-5 text-sm ${dark ? "border-cyan-500/20 bg-cyan-500/5 text-gray-200" : "border-cyan-200 bg-cyan-50 text-gray-700"}`}>
                    Für Retoure vorgemerkt: <span className="font-semibold">{currentOrder.orderNumber}</span>. Wechsle in den Tab <span className="font-semibold">Retoure</span>, um die Rücknahme fertig zu buchen.
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
        {posMode && salesTab === "sale" ? (
          <div className={`rounded-[1.6rem] border px-5 py-4 text-sm ${dark ? "border-cyan-500/10 bg-gray-950/40 text-gray-300" : "border-cyan-100 bg-cyan-50 text-gray-700"}`}>
            Tippe rechts einen Artikel an. Retoure und letzte Verkäufe liegen oben in eigenen Tabs, damit die Produktfläche auf 16:9- und Tablet-Screens frei bleibt.
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
