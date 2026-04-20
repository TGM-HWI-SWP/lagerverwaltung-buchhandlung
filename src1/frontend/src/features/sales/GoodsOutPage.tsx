import { useMemo, useState } from "react";

import { apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CatalogProduct, ReturnResponse, SaleOrder, StockEntry, Warehouse } from "@/types";

interface GoodsOutPageProps {
  card: string;
  dark: boolean;
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
  const [quantity, setQuantity] = useState("1");
  const [customDiscountAmount, setCustomDiscountAmount] = useState("0");
  const [isFirstCustomer, setIsFirstCustomer] = useState(false);
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
  const currentStock = stockEntries.filter((entry) => entry.warehouseCode === warehouseCode);
  const selectableProducts = useMemo(
    () => currentStock.filter((entry) => entry.onHand > 0).sort((a, b) => a.title.localeCompare(b.title)),
    [currentStock],
  );
  const selectedStock = selectableProducts.find((entry) => entry.productId === productId) ?? null;
  const selectedProduct = products.find((entry) => entry.id === productId) ?? null;

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
      });
      setQuantity("1");
      setCustomDiscountAmount("0");
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold">Verkauf je Lagerort</h2>
          <p className={`mt-1 text-sm ${mutedText}`}>Verkäufe greifen direkt auf den Bestand des gewählten Lagerorts zu. Preise kommen aus dem Preis-Stack, nicht aus dem Produktstamm.</p>
          <div className="mt-5 grid gap-3">
            <select className={inputClass} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.code}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
            </select>
            <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Produkt wählen</option>
              {selectableProducts.map((entry) => (
                <option key={entry.productId} value={entry.productId}>
                  {entry.title} · {entry.onHand} Stk. · €{entry.sellingPrice.toFixed(2)}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input className={inputClass} inputMode="numeric" placeholder="Menge" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <input className={inputClass} inputMode="decimal" placeholder="Zusätzlicher Rabatt" value={customDiscountAmount} onChange={(e) => setCustomDiscountAmount(e.target.value)} />
            </div>
            <label className={`text-sm ${mutedText}`}>
              <input type="checkbox" checked={isFirstCustomer} onChange={(e) => setIsFirstCustomer(e.target.checked)} /> Erstkunde
            </label>
            {selectedStock ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? "border-gray-800 bg-gray-950 text-gray-200" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                Verfügbar in {warehouseCode}: {selectedStock.onHand} Stk. · Verkaufspreis €{selectedStock.sellingPrice.toFixed(2)}
              </div>
            ) : null}
            <Button onClick={createSale} disabled={busy}>
              {busy ? "Buche..." : "Verkauf buchen"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold">Retoure aus Verkaufshistorie</h2>
          <p className={`mt-1 text-sm ${mutedText}`}>Retouren greifen auf echte Verkaufszeilen zurück und schreiben Gegenbewegungen ins Ledger.</p>
          <div className="mt-5 space-y-3">
            <select className={inputClass} value={returnOrderId} onChange={(e) => { setReturnOrderId(e.target.value); setReturnLineId(""); }}>
              <option value="">Verkaufsauftrag wählen</option>
              {salesOrders.map((order) => (
                <option key={order.orderId} value={order.orderId}>
                  {order.orderNumber} · {order.warehouseCode} · €{order.total.toFixed(2)}
                </option>
              ))}
            </select>
            <select className={inputClass} value={returnLineId} onChange={(e) => setReturnLineId(e.target.value)}>
              <option value="">Verkaufszeile wählen</option>
              {(salesOrders.find((order) => order.orderId === returnOrderId)?.lines ?? []).map((line) => (
                <option key={line.lineId} value={line.lineId}>
                  {line.productName} · {line.quantity} Stk.
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input className={inputClass} inputMode="numeric" placeholder="Retourmenge" value={returnQuantity} onChange={(e) => setReturnQuantity(e.target.value)} />
              <input className={inputClass} placeholder="Grund" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
            </div>
            <Button variant="outline" onClick={createReturn} disabled={busy}>
              {busy ? "Buche..." : "Retoure buchen"}
            </Button>
          </div>
          {statusMessage ? <p className="mt-4 text-sm text-blue-400">{statusMessage}</p> : null}
        </CardContent>
      </Card>

      <Card className={`${card} xl:col-span-2`}>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold">Verkaufshistorie</h3>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className={`border-b ${dark ? "border-gray-800" : "border-gray-200"} text-xs uppercase ${mutedText}`}>
                  <th className="py-3">Zeit</th>
                  <th>Auftrag</th>
                  <th>Lagerort</th>
                  <th>Positionen</th>
                  <th>Rabatt</th>
                  <th>Summe</th>
                </tr>
              </thead>
              <tbody>
                {salesOrders.map((order) => (
                  <tr key={order.orderId} className={`border-b ${dark ? "border-gray-800" : "border-gray-200"} last:border-b-0 align-top`}>
                    <td className="py-3">{new Date(order.createdAt).toLocaleString("de-DE")}</td>
                    <td>{order.orderNumber}</td>
                    <td>{order.warehouseCode}</td>
                    <td>
                      {order.lines.map((line) => (
                        <div key={line.lineId}>
                          {line.productName} · {line.quantity} Stk. · €{line.total.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td>€{order.discountTotal.toFixed(2)}</td>
                    <td>€{order.total.toFixed(2)}</td>
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
