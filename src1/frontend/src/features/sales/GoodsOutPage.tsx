import { useMemo, useState } from "react";
import { ShoppingCart, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Book, SaleEntry } from "@/types";
import { parseSaleEntry } from "@/lib/mappers";
import { apiPost } from "@/api/client";

function tableBorderClass(dark: boolean): string {
  return dark ? "border-gray-800" : "border-gray-200";
}

interface GoodsOutPageProps {
  card: string;
  dark: boolean;
  books: Book[];
  reloadBooks: () => void;
  salesLog: SaleEntry[];
  reloadMovements: () => void;
}

export function GoodsOutPage({ card, dark, books, reloadBooks, salesLog, reloadMovements }: GoodsOutPageProps) {
  const [mobileMode, setMobileMode] = useState(false);
  const [saleType, setSaleType] = useState<"Verkauf" | "Retoure">("Verkauf");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<SaleEntry | null>(null);

  const selectedBook = useMemo(() => books.find((b) => b.id === selectedBookId) ?? null, [books, selectedBookId]);

  const inputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

  const recordSale = async () => {
    if (!selectedBook) return;
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (!Number.isFinite(price) || price < 0) return;

    setProcessing(true);
    try {
      const movementType = saleType === "Verkauf" ? "OUT" : "IN";
      const reasonText = `${saleType} von ${selectedBook.name} [price=${price.toFixed(2)}]`;
      await apiPost<import("@/types").MovementApi, {
        book_id: string;
        quantity_change: number;
        movement_type: string;
        reason: string;
        performed_by: string;
      }>("/movements", {
        book_id: selectedBook.id,
        quantity_change: qty,
        movement_type: movementType,
        reason: reasonText,
        performed_by: "system",
      });
      setLastSale({
        id: Date.now().toString(),
        bookId: selectedBook.id,
        bookName: selectedBook.name,
        type: saleType,
        quantity: qty,
        unitPrice: price,
        total: saleType === "Verkauf" ? price * qty : -price * qty,
        createdAt: new Date().toISOString(),
        reason: reasonText,
      }));
      reloadBooks();
      reloadMovements();
      setQuantity("1");
      setUnitPrice(selectedBook.sellingPrice.toString());
    } catch (err) {
      console.error("Failed to record sale:", err);
    } finally {
      setProcessing(false);
    }
  };

  if (mobileMode) {
    return (
      <div className="space-y-6">
        <Card className={card}>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Verkauf (Mobile)</h2>
              <Button variant="outline" size="sm" onClick={() => setMobileMode(false)}>
                <Smartphone size={18} className="mr-2" />
                Desktop
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                className={inputClass}
                value={selectedBookId}
                onChange={(e) => {
                  setSelectedBookId(e.target.value);
                  const book = books.find((b) => b.id === e.target.value);
                  if (book) setUnitPrice(book.sellingPrice.toString());
                }}
              >
                <option value="">Buch wählen</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.name} (€{book.sellingPrice.toFixed(2)})
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <Button
                  variant={saleType === "Verkauf" ? "default" : "outline"}
                  onClick={() => setSaleType("Verkauf")}
                  className="flex-1"
                >
                  Verkauf
                </Button>
                <Button
                  variant={saleType === "Retoure" ? "default" : "outline"}
                  onClick={() => setSaleType("Retoure")}
                  className="flex-1"
                >
                  Retoure
                </Button>
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">Menge</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-2"
                    onClick={() => setQuantity((q) => String(Math.max(1, Number(q) - 1)))}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    className={`${inputClass} text-center`}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-2"
                    onClick={() => setQuantity((q) => String(Number(q) + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">Preis (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className={inputClass}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={recordSale}
                  disabled={processing || !selectedBookId || !quantity}
                >
                  {processing ? "Erfas..." : saleType === "Verkauf" ? "Verkauf erfassen" : "Retoure erfassen"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {lastSale && (
          <Card className={card}>
            <CardContent className="p-6">
              <h3 className="mb-2 text-base font-semibold">Letzter Erfassung</h3>
              <p>
                <strong>{lastSale.bookName}</strong> - {lastSale.type}: {lastSale.quantity} × €{lastSale.unitPrice.toFixed(2)} = €{lastSale.total.toFixed(2)}
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setLastSale(null)}>
                Zurücksetzen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Desktop mode
  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Verkauf & Retoure</h2>
            <Button variant="outline" size="sm" onClick={() => setMobileMode(true)}>
              <Smartphone size={18} className="mr-2" />
              Mobile Ansicht
            </Button>
          </div>

          <div className={`grid grid-cols-1 gap-3 rounded-xl border p-4 ${tableBorderClass(dark)} md:grid-cols-4`}>
            <select
              className={inputClass}
              value={selectedBookId}
              onChange={(e) => {
                setSelectedBookId(e.target.value);
                const book = books.find((b) => b.id === e.target.value);
                if (book) setUnitPrice(book.sellingPrice.toString());
              }}
            >
              <option value="">Buch auswählen</option>
              {books.sort((a, b) => a.name.localeCompare(b.name)).map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name} (€{book.sellingPrice.toFixed(2)}, {book.quantity} Stk.)
                </option>
              ))}
            </select>

            <select
              className={inputClass}
              value={saleType}
              onChange={(e) => setSaleType(e.target.value as "Verkauf" | "Retoure")}
            >
              <option value="Verkauf">Verkauf</option>
              <option value="Retoure">Retoure</option>
            </select>

            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder="Menge"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />

            <input
              type="number"
              step="0.01"
              min={0}
              className={inputClass}
              placeholder="Preis (€)"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />

            <div className="md:col-span-4">
              <Button onClick={recordSale} disabled={processing || !selectedBookId}>
                {processing ? "Erfasse..." : saleType === "Verkauf" ? "Verkauf erfassen" : "Retoure erfassen"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Letzte Verkäufe & Retouren</h2>
          {salesLog.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>Keine Verkäufe/Retouren erfasst.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={`border-b ${tableBorderClass(dark)} text-xs uppercase ${tableHeadText}`}>
                    <th className="py-2">Datum</th>
                    <th>Buch</th>
                    <th>Typ</th>
                    <th>Menge</th>
                    <th>Preis</th>
                    <th>Gesamt</th>
                    <th>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {salesLog.slice(0, 50).map((entry) => (
                    <tr key={entry.id} className={`border-b ${tableBorderClass(dark)} last:border-b-0`}>
                      <td className="py-2">{new Date(entry.createdAt).toLocaleString("de-DE")}</td>
                      <td>{entry.bookName}</td>
                      <td>
                        <span className={entry.type === "Verkauf" ? "text-green-600" : "text-red-600"}>
                          {entry.type}
                        </span>
                      </td>
                      <td>{entry.quantity}</td>
                      <td>€{entry.unitPrice.toFixed(2)}</td>
                      <td className={entry.total >= 0 ? "text-green-600" : "text-red-600"}>
                        €{entry.total.toFixed(2)}
                      </td>
                      <td className="py-2">
                        {entry.type === "Verkauf" && (
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedBookId(entry.bookId);
                            setQuantity(String(entry.quantity));
                            setUnitPrice(String(entry.unitPrice));
                            setSaleType("Retoure");
                          }}>
                            Retournieren
                          </Button>
                        )}
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

function tableBorderClass(dark: boolean): string {
  return dark ? "border-gray-800" : "border-gray-200";
}
