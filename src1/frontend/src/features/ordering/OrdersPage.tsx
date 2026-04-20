import { useState } from "react";

import { apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CatalogProduct, PurchaseOrderApi, PurchaseOrderDraftLine, PurchaseOrder, Supplier } from "@/types";
import { mapPurchaseOrderApi } from "@/lib/mappers";

interface OrdersPageProps {
  card: string;
  dark: boolean;
  products: CatalogProduct[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  reloadOrders: () => Promise<void>;
}

const EMPTY_LINE: PurchaseOrderDraftLine = {
  productId: "",
  quantity: "1",
  unitCost: "0",
};

export function OrdersPage({ card, dark, products, suppliers, orders, reloadOrders }: OrdersPageProps) {
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseOrderDraftLine[]>([{ ...EMPTY_LINE }]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = dark
    ? "w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";

  const createOrder = async () => {
    setCreating(true);
    setError(null);
    try {
      const payloadLines = lines
        .filter((line) => line.productId.trim() !== "")
        .map((line) => ({
          product_id: line.productId,
          quantity: Math.max(1, Number(line.quantity) || 1),
          unit_cost: Math.max(0, Number(line.unitCost) || 0),
        }));
      if (!supplierId) throw new Error("Bitte einen Lieferanten auswählen.");
      if (payloadLines.length === 0) throw new Error("Bitte mindestens eine Position ergänzen.");

      await apiPost<PurchaseOrderApi, { supplier_id: string; notes: string; lines: typeof payloadLines }>("/purchase-orders", {
        supplier_id: supplierId,
        notes: notes.trim(),
        lines: payloadLines,
      });
      setSupplierId("");
      setNotes("");
      setLines([{ ...EMPTY_LINE }]);
      await reloadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bestellung konnte nicht angelegt werden.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Einkauf mit mehreren Positionen</h2>
          <p className={`text-sm ${mutedText}`}>Bestellungen sind jetzt echte Aufträge mit mehreren Zeilen. Der Wareneingang passiert im eigenen Bereich pro Lagerort.</p>
          <div className="grid gap-3">
            <select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Lieferant wählen</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <textarea className={`${inputClass} min-h-24`} placeholder="Notiz zur Bestellung" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className={`grid gap-3 rounded-3xl border p-4 ${dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-gray-50"} lg:grid-cols-[1.6fr_1fr_1fr_auto]`}>
                  <select
                    className={inputClass}
                    value={line.productId}
                    onChange={(e) => setLines((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, productId: e.target.value } : row))}
                  >
                    <option value="">Produkt wählen</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.title}
                      </option>
                    ))}
                  </select>
                  <input className={inputClass} inputMode="numeric" placeholder="Menge" value={line.quantity} onChange={(e) => setLines((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: e.target.value } : row))} />
                  <input className={inputClass} inputMode="decimal" placeholder="EK" value={line.unitCost} onChange={(e) => setLines((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: e.target.value } : row))} />
                  <Button variant="outline" onClick={() => setLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index || prev.length === 1))}>
                    Entfernen
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}>
                Position hinzufügen
              </Button>
              <Button onClick={createOrder} disabled={creating}>
                {creating ? "Speichere..." : "Bestellung anlegen"}
              </Button>
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold">Offene und historische Bestellungen</h3>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className={`border-b ${tableBorder} text-xs uppercase ${mutedText}`}>
                  <th className="py-3">Nummer</th>
                  <th>Lieferant</th>
                  <th>Status</th>
                  <th>Bestellt</th>
                  <th>Positionen</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={`border-b ${tableBorder} last:border-b-0 align-top`}>
                    <td className="py-3 font-medium">{order.orderNumber}</td>
                    <td>{order.supplierName}</td>
                    <td>{order.status}</td>
                    <td>{new Date(order.orderedAt).toLocaleString("de-DE")}</td>
                    <td>
                      <div className="space-y-1">
                        {order.lines.map((line) => (
                          <div key={line.lineId} className={`rounded-xl px-3 py-2 ${dark ? "bg-gray-950" : "bg-gray-100"}`}>
                            {line.productTitle} · {line.quantity} Stk. · offen {line.remainingQuantity} · EK €{line.unitCost.toFixed(2)}
                          </div>
                        ))}
                      </div>
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
