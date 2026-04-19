import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { IncomingDelivery, Movement, Book } from "@/types";
import { mapIncomingDeliveryApi } from "@/lib/mappers";
import { apiPost, apiGet } from "@/api/client";

interface GoodsInPageProps {
  card: string;
  dark: boolean;
  books: Book[];
  incomingDeliveries: IncomingDelivery[];
  setIncomingDeliveries: React.Dispatch<React.SetStateAction<IncomingDelivery[]>>;
  reloadBooks: () => void;
  reloadIncomingDeliveries: () => void;
  reloadMovements: () => void;
}

export function GoodsInPage({
  card,
  dark,
  books,
  incomingDeliveries,
  setIncomingDeliveries,
  reloadBooks,
  reloadIncomingDeliveries,
  reloadMovements,
}: GoodsInPageProps) {
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const formInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const bookIncoming = async (deliveryId: string) => {
    try {
      await apiPost<Movement, { performed_by: string }>(`/incoming-deliveries/${deliveryId}/book`, {
        performed_by: "system",
      });
      setIncomingDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));
      reloadBooks();
      reloadMovements();
    } catch (err) {
      console.error("Failed to book delivery:", err);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Wareneingang</h2>
          <p className={`mb-4 text-sm ${mutedText}`}>
            Offene Lieferungen ankommen und hier ins Lager einbuchen.
          </p>

          {incomingDeliveries.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>Keine ausstehenden Wareneingänge.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                    <th className="py-2">Lieferant</th>
                    <th>Buch</th>
                    <th>Menge</th>
                    <th>Einkaufspreis</th>
                    <th>Erhalten am</th>
                    <th>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingDeliveries.map((delivery) => (
                    <tr key={delivery.id} className={`border-b ${tableBorder} last:border-b-0`}>
                      <td className="py-2">{delivery.supplier}</td>
                      <td>{delivery.bookName}</td>
                      <td>{delivery.quantity}</td>
                      <td>€{delivery.unitPrice.toFixed(2)}</td>
                      <td>{new Date(delivery.receivedAt).toLocaleString("de-DE")}</td>
                      <td className="py-2">
                        <Button size="sm" variant="outline" onClick={() => bookIncoming(delivery.id)}>
                          Einbuchen
                        </Button>
                      </td>
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
