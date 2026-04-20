import { useState } from "react";

import { apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PurchaseOrder, Warehouse } from "@/types";

interface GoodsInPageProps {
  card: string;
  dark: boolean;
  orders: PurchaseOrder[];
  warehouses: Warehouse[];
  reloadOrders: () => Promise<void>;
  reloadStockEntries: () => Promise<void>;
  reloadLedgerEntries: () => Promise<void>;
}

export function GoodsInPage({ card, dark, orders, warehouses, reloadOrders, reloadStockEntries, reloadLedgerEntries }: GoodsInPageProps) {
  const [drafts, setDrafts] = useState<Record<string, { warehouseCode: string; lines: Record<string, string> }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const mutedText = dark ? "text-gray-400" : "text-gray-500";

  const openOrders = orders.filter((order) => order.status !== "RECEIVED" && order.lines.some((line) => line.remainingQuantity > 0));

  const receiveOrder = async (order: PurchaseOrder) => {
    const draft = drafts[order.id] ?? { warehouseCode: "STORE", lines: {} };
    const payloadLines = order.lines
      .map((line) => ({
        line_id: line.lineId,
        receive_quantity: Math.max(0, Number(draft.lines[line.lineId] ?? 0) || 0),
      }))
      .filter((line) => line.receive_quantity > 0);

    if (payloadLines.length === 0) {
      setError("Bitte mindestens eine Empfangsmenge > 0 eingeben.");
      return;
    }

    setBusyOrderId(order.id);
    setError(null);
    try {
      await apiPost(`/purchase-orders/${order.id}/receive`, {
        warehouse_code: draft.warehouseCode || "STORE",
        lines: payloadLines,
      });
      await Promise.all([reloadOrders(), reloadStockEntries(), reloadLedgerEntries()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wareneingang konnte nicht gebucht werden.");
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold">Wareneingang je Lagerort</h2>
          <p className={`mt-1 text-sm ${mutedText}`}>Offene Bestellzeilen werden direkt in einen ausgewählten Lagerort eingebucht und erzeugen dabei Ledger-Einträge.</p>
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

          <div className="mt-5 space-y-4">
            {openOrders.length === 0 ? (
              <div className={`rounded-3xl border border-dashed p-5 text-sm ${mutedText}`}>Keine offenen Wareneingänge vorhanden.</div>
            ) : (
              openOrders.map((order) => {
                const draft = drafts[order.id] ?? { warehouseCode: "STORE", lines: {} };
                return (
                  <div key={order.id} className={`rounded-3xl border p-5 ${dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-gray-50"}`}>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-semibold">{order.orderNumber}</div>
                        <div className={`text-sm ${mutedText}`}>{order.supplierName} · {order.status}</div>
                      </div>
                      <select
                        className={dark ? "rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white" : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"}
                        value={draft.warehouseCode}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [order.id]: { ...draft, warehouseCode: e.target.value } }))}
                      >
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.code}>
                            {warehouse.code} · {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {order.lines.filter((line) => line.remainingQuantity > 0).map((line) => (
                        <div key={line.lineId} className="grid gap-3 lg:grid-cols-[1.8fr_0.8fr_0.8fr_1fr]">
                          <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? "border-gray-700 bg-gray-900 text-gray-200" : "border-gray-200 bg-white text-gray-700"}`}>
                            {line.productTitle}
                          </div>
                          <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? "border-gray-700 bg-gray-900 text-gray-200" : "border-gray-200 bg-white text-gray-700"}`}>
                            offen {line.remainingQuantity}
                          </div>
                          <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? "border-gray-700 bg-gray-900 text-gray-200" : "border-gray-200 bg-white text-gray-700"}`}>
                            EK €{line.unitCost.toFixed(2)}
                          </div>
                          <input
                            className={dark ? "rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white" : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"}
                            inputMode="numeric"
                            placeholder="Empfang"
                            value={draft.lines[line.lineId] ?? String(line.remainingQuantity)}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [order.id]: {
                                  ...draft,
                                  lines: { ...draft.lines, [line.lineId]: e.target.value },
                                },
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <Button className="mt-4" onClick={() => receiveOrder(order)} disabled={busyOrderId === order.id}>
                      {busyOrderId === order.id ? "Buche..." : "Wareneingang buchen"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
