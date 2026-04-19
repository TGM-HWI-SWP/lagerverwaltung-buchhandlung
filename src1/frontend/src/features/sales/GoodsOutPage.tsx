import { useEffect, useMemo, useState } from "react";
import { Calculator, Clock3, Receipt, RotateCcw, ShoppingCart } from "lucide-react";

import { apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Book, MovementApi, SaleEntry } from "@/types";

interface GoodsOutPageProps {
  card: string;
  dark: boolean;
  books: Book[];
  reloadBooks: () => void;
  salesLog: SaleEntry[];
  reloadMovements: () => void;
}

type SaleMode = "Verkauf" | "Retoure";
type SalesView = "kasse" | "historie";
type KeypadTarget = "quantity" | "price" | "discount";

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "00"];

export function GoodsOutPage({ card, dark, books, reloadBooks, salesLog, reloadMovements }: GoodsOutPageProps) {
  const [activeView, setActiveView] = useState<SalesView>("kasse");
  const [saleType, setSaleType] = useState<SaleMode>("Verkauf");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discountMode, setDiscountMode] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("0");
  const [firstCustomer, setFirstCustomer] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState<KeypadTarget>("quantity");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<SaleEntry | null>(null);
  const [historySearch, setHistorySearch] = useState("");

  const selectedBook = useMemo(() => books.find((b) => b.id === selectedBookId) ?? null, [books, selectedBookId]);
  const selectableBooks = useMemo(
    () => (saleType === "Verkauf" ? books.filter((book) => book.quantity > 0) : books).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [books, saleType],
  );

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return salesLog;
    return salesLog.filter((entry) => [entry.bookName, entry.reason, entry.type].some((value) => value.toLowerCase().includes(query)));
  }, [historySearch, salesLog]);

  const inputClass = dark
    ? "w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500";
  const shellClass = dark ? "border-gray-800 bg-gray-900/70" : "border-gray-200 bg-white";
  const panelClass = dark ? "border-gray-800 bg-gray-950/70" : "border-gray-200 bg-gray-50";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const textSoft = dark ? "text-gray-300" : "text-gray-700";

  useEffect(() => {
    if (!selectedBook) return;
    setUnitPrice(selectedBook.sellingPrice.toFixed(2).replace(".", ","));
  }, [selectedBook?.id]);

  useEffect(() => {
    if (discountMode === "none") {
      setDiscountValue("0");
    }
  }, [discountMode]);

  const quantityNumber = Math.max(1, Number(quantity) || 1);
  const unitPriceNumber = Math.max(0, Number(unitPrice.replace(",", ".")) || 0);
  const discountInputNumber = Math.max(0, Number(discountValue.replace(",", ".")) || 0);
  const subtotal = quantityNumber * unitPriceNumber;
  const discountAmount =
    saleType !== "Verkauf" || discountMode === "none"
      ? 0
      : discountMode === "percent"
        ? Math.min(subtotal, subtotal * (discountInputNumber / 100))
        : Math.min(subtotal, discountInputNumber);
  const total = saleType === "Verkauf" ? subtotal - discountAmount : unitPriceNumber * quantityNumber;

  const setActiveFieldValue = (nextValue: string) => {
    if (keypadTarget === "quantity") {
      setQuantity(nextValue.replace(/[^\d]/g, "") || "0");
      return;
    }
    const normalized = nextValue
      .replace(/[^\d,]/g, "")
      .replace(/^,+/, "")
      .replace(/,{2,}/g, ",")
      .replace(/,(\d*),/g, ",$1");

    if (keypadTarget === "price") {
      setUnitPrice(normalized);
      return;
    }
    setDiscountValue(normalized);
  };

  const activeFieldValue = keypadTarget === "quantity" ? quantity : keypadTarget === "price" ? unitPrice : discountValue;

  const handleKeypadPress = (key: string) => {
    if (key === "," && keypadTarget === "quantity") return;
    if (key === "," && activeFieldValue.includes(",")) return;
    const nextValue = activeFieldValue === "0" && key !== "," ? key : `${activeFieldValue}${key}`;
    setActiveFieldValue(nextValue);
  };

  const resetSaleForm = () => {
    setQuantity("1");
    setDiscountValue("0");
    setDiscountMode("none");
    setFirstCustomer(false);
    setKeypadTarget("quantity");
    if (selectedBook) {
      setUnitPrice(selectedBook.sellingPrice.toFixed(2).replace(".", ","));
    }
  };

  const recordSale = async () => {
    if (!selectedBook) {
      setStatusMessage("Bitte zuerst ein Buch auswählen.");
      return;
    }
    if (saleType === "Verkauf" && quantityNumber > selectedBook.quantity) {
      setStatusMessage(`Nur ${selectedBook.quantity} Exemplare von "${selectedBook.name}" verfügbar.`);
      return;
    }

    setProcessing(true);
    setStatusMessage(null);
    try {
      const reasonParts = [`${saleType}: ${selectedBook.name}`, `[price=${unitPriceNumber.toFixed(2)}]`];
      if (saleType === "Verkauf" && discountAmount > 0) reasonParts.push(`[discount=${discountAmount.toFixed(2)}]`);
      if (saleType === "Verkauf" && firstCustomer) reasonParts.push("[first_customer=true]");

      await apiPost<
        MovementApi,
        { book_id: string; quantity_change: number; movement_type: string; reason: string; performed_by: string }
      >("/movements", {
        book_id: selectedBook.id,
        quantity_change: quantityNumber,
        movement_type: saleType === "Verkauf" ? "OUT" : "IN",
        reason: reasonParts.join(" "),
        performed_by: "system",
      });

      setLastSale({
        id: `${Date.now()}`,
        bookId: selectedBook.id,
        bookName: selectedBook.name,
        type: saleType,
        quantity: quantityNumber,
        unitPrice: unitPriceNumber,
        total: saleType === "Verkauf" ? total : -total,
        createdAt: new Date().toISOString(),
        reason: reasonParts[0],
        discountAmount: saleType === "Verkauf" ? discountAmount : 0,
      });

      resetSaleForm();
      setStatusMessage(saleType === "Verkauf" ? "Verkauf erfolgreich gebucht." : "Retoure erfolgreich gebucht.");
      await Promise.all([reloadBooks(), reloadMovements()]);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Buchung konnte nicht gespeichert werden.");
    } finally {
      setProcessing(false);
    }
  };

  const prepareReturn = (entry: SaleEntry) => {
    setActiveView("kasse");
    setSelectedBookId(entry.bookId);
    setQuantity(String(entry.quantity));
    setUnitPrice(entry.unitPrice.toFixed(2).replace(".", ","));
    setSaleType("Retoure");
    setStatusMessage(`Retoure für "${entry.bookName}" vorbereitet.`);
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col">
      <div className={`flex-1 rounded-[2rem] border p-4 sm:p-6 ${shellClass}`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Kassenbereich</h2>
            <p className={`mt-2 text-sm ${mutedText}`}>Großflächig für Kasse, Touch und schnelles Arbeiten. Historie liegt jetzt separat im eigenen Tab innerhalb des Verkaufsbereichs.</p>
          </div>
          <div className={`inline-flex rounded-2xl border p-1 ${panelClass}`}>
            <button
              type="button"
              onClick={() => setActiveView("kasse")}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${activeView === "kasse" ? "bg-blue-600 text-white" : mutedText}`}
            >
              Kasse
            </button>
            <button
              type="button"
              onClick={() => setActiveView("historie")}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${activeView === "historie" ? "bg-blue-600 text-white" : mutedText}`}
            >
              Verkaufshistorie
            </button>
          </div>
        </div>

        {activeView === "kasse" ? (
          <div className="mt-6 grid flex-1 gap-5 xl:grid-cols-[minmax(360px,1.2fr)_minmax(340px,0.8fr)]">
            <div className="grid gap-5 lg:grid-cols-[minmax(320px,1fr)_minmax(280px,0.9fr)]">
              <Card className={`${card} h-full`}>
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Buchung</h3>
                      <p className={`mt-1 text-sm ${mutedText}`}>Titel wählen, Werte eingeben und direkt buchen.</p>
                    </div>
                    <div className={`inline-flex rounded-2xl border p-1 ${panelClass}`}>
                      <button type="button" onClick={() => setSaleType("Verkauf")} className={`rounded-xl px-4 py-2 text-sm ${saleType === "Verkauf" ? "bg-blue-600 text-white" : mutedText}`}>
                        <ShoppingCart size={15} className="mr-2 inline" />
                        Verkauf
                      </button>
                      <button type="button" onClick={() => setSaleType("Retoure")} className={`rounded-xl px-4 py-2 text-sm ${saleType === "Retoure" ? "bg-blue-600 text-white" : mutedText}`}>
                        <RotateCcw size={15} className="mr-2 inline" />
                        Retoure
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className={`mb-2 block text-sm font-medium ${textSoft}`}>Buch auswählen</label>
                      <select className={inputClass} value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)}>
                        <option value="">Buch auswählen...</option>
                        {selectableBooks.map((book) => (
                          <option key={book.id} value={book.id}>
                            {book.name} ({book.quantity} Stk., €{book.sellingPrice.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={`grid gap-3 rounded-3xl border p-4 sm:grid-cols-3 ${panelClass}`}>
                      <MetricField label="Menge" value={quantity} active={keypadTarget === "quantity"} onClick={() => setKeypadTarget("quantity")} dark={dark} />
                      <MetricField label="Preis" value={unitPrice || "0"} active={keypadTarget === "price"} onClick={() => setKeypadTarget("price")} dark={dark} />
                      <MetricField
                        label={discountMode === "percent" ? "Rabatt %" : "Rabatt"}
                        value={discountMode === "none" ? "-" : discountValue}
                        active={keypadTarget === "discount"}
                        onClick={() => setKeypadTarget("discount")}
                        dark={dark}
                        disabled={saleType !== "Verkauf" || discountMode === "none"}
                      />
                    </div>

                    {selectedBook ? (
                      <div className={`grid gap-3 rounded-3xl border p-4 md:grid-cols-3 ${panelClass}`}>
                        <InfoTile label="Bestand" value={`${selectedBook.quantity} Stk.`} mutedText={mutedText} />
                        <InfoTile label="Autor" value={selectedBook.author || "-"} mutedText={mutedText} />
                        <InfoTile label="Kategorie" value={selectedBook.category || "-"} mutedText={mutedText} />
                      </div>
                    ) : (
                      <div className={`rounded-3xl border border-dashed p-5 text-sm ${mutedText}`}>Wähle ein Buch aus, damit Preis und Kontext automatisch passen.</div>
                    )}

                    {saleType === "Verkauf" && (
                      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-center">
                        <select className={inputClass} value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "none" | "percent" | "fixed")}>
                          <option value="none">Kein Rabatt</option>
                          <option value="percent">Rabatt in %</option>
                          <option value="fixed">Rabatt in EUR</option>
                        </select>
                        <label className="inline-flex items-center gap-2 rounded-2xl px-2 py-3 text-sm">
                          <input type="checkbox" checked={firstCustomer} onChange={(e) => setFirstCustomer(e.target.checked)} />
                          Erstkunde
                        </label>
                      </div>
                    )}

                    {statusMessage && <div className={`rounded-2xl px-4 py-3 text-sm ${panelClass}`}>{statusMessage}</div>}
                  </div>

                  <div className="mt-auto grid gap-3 pt-5 sm:grid-cols-2">
                    <Button className="min-h-14 text-base" onClick={recordSale} disabled={processing || !selectedBookId}>
                      {processing ? "Buchung läuft..." : saleType === "Verkauf" ? "Verkauf buchen" : "Retoure buchen"}
                    </Button>
                    <Button variant="outline" className="min-h-14 text-base" onClick={resetSaleForm}>
                      Zurücksetzen
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5">
                <Card className={`${card} h-full`}>
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                      <Calculator size={16} />
                      Zahlenpad
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {KEYPAD_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleKeypadPress(key)}
                          className={`min-h-20 rounded-2xl border text-2xl font-semibold transition ${dark ? "border-gray-700 bg-gray-950 hover:bg-gray-900" : "border-gray-200 bg-gray-50 hover:bg-gray-100"}`}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Button variant="outline" className="min-h-12" onClick={() => setActiveFieldValue(activeFieldValue.slice(0, -1) || (keypadTarget === "quantity" ? "1" : "0"))}>
                        Löschen
                      </Button>
                      <Button variant="outline" className="min-h-12" onClick={() => setActiveFieldValue(keypadTarget === "quantity" ? "1" : "0")}>
                        Feld leeren
                      </Button>
                    </div>
                    <div className={`mt-4 rounded-2xl border p-4 ${panelClass}`}>
                      <div className={mutedText}>Aktives Feld</div>
                      <div className="mt-1 text-lg font-semibold">{keypadTarget === "quantity" ? "Menge" : keypadTarget === "price" ? "Preis" : "Rabatt"}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`${card} h-full`}>
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                      <Receipt size={16} />
                      Zusammenfassung
                    </div>
                    <div className="space-y-3">
                      <SummaryRow label="Zwischensumme" value={`€${subtotal.toFixed(2)}`} mutedText={mutedText} />
                      <SummaryRow label="Rabatt" value={`€${discountAmount.toFixed(2)}`} mutedText={mutedText} />
                      <SummaryRow label={saleType === "Verkauf" ? "Zu kassieren" : "Rückerstattung"} value={`€${total.toFixed(2)}`} mutedText={mutedText} strong />
                    </div>
                    {lastSale && (
                      <div className={`mt-4 rounded-2xl border p-4 ${panelClass}`}>
                        <div className={`text-xs uppercase tracking-wide ${mutedText}`}>Letzte Buchung</div>
                        <div className="mt-2 font-semibold">{lastSale.bookName}</div>
                        <div className={`mt-1 text-sm ${textSoft}`}>
                          {lastSale.type} · {lastSale.quantity} Stk. · €{Math.abs(lastSale.total).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className={`${card} h-full`}>
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center gap-2">
                  <Clock3 size={17} />
                  <h3 className="text-lg font-semibold">Schneller Verlauf</h3>
                </div>
                <p className={`mt-1 text-sm ${mutedText}`}>Die letzten Buchungen bleiben direkt neben der Kasse sichtbar.</p>

                <div className="mt-4 flex-1 space-y-3 overflow-auto pr-1">
                  {salesLog.slice(0, 10).map((entry) => (
                    <div key={entry.id} className={`rounded-2xl border p-4 ${panelClass}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{entry.bookName}</div>
                          <div className={`mt-1 text-xs ${mutedText}`}>{new Date(entry.createdAt).toLocaleString("de-DE")}</div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.type === "Verkauf" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                          {entry.type}
                        </span>
                      </div>
                      <div className={`mt-3 grid grid-cols-3 gap-2 text-sm ${textSoft}`}>
                        <div>{entry.quantity} Stk.</div>
                        <div>€{entry.unitPrice.toFixed(2)}</div>
                        <div className={entry.total >= 0 ? "text-emerald-400" : "text-amber-400"}>€{Math.abs(entry.total).toFixed(2)}</div>
                      </div>
                      {entry.type === "Verkauf" && (
                        <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => prepareReturn(entry)}>
                          Retoure daraus machen
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            <Card className={card}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Verkaufshistorie</h3>
                    <p className={`mt-1 text-sm ${mutedText}`}>Alle letzten Verkäufe und Retouren in einer eigenen Ansicht.</p>
                  </div>
                  <input
                    className={`${inputClass} lg:max-w-md`}
                    placeholder="Suche nach Buch, Typ oder Grund..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>

                <div className="mt-5 space-y-3 md:hidden">
                  {filteredHistory.length === 0 ? (
                    <div className={`rounded-2xl border border-dashed p-4 text-sm ${mutedText}`}>Keine passenden Einträge gefunden.</div>
                  ) : (
                    filteredHistory.slice(0, 100).map((entry) => (
                      <div key={entry.id} className={`rounded-2xl border p-4 ${panelClass}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{entry.bookName}</div>
                            <div className={`mt-1 text-xs ${mutedText}`}>{new Date(entry.createdAt).toLocaleString("de-DE")}</div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.type === "Verkauf" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                            {entry.type}
                          </span>
                        </div>
                        <div className={`mt-3 space-y-1 text-sm ${textSoft}`}>
                          <div>Menge: {entry.quantity}</div>
                          <div>Preis: €{entry.unitPrice.toFixed(2)}</div>
                          <div>Gesamt: €{Math.abs(entry.total).toFixed(2)}</div>
                          <div>Grund: {entry.reason}</div>
                        </div>
                        {entry.type === "Verkauf" && (
                          <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => prepareReturn(entry)}>
                            In Kasse öffnen
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5 hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={`border-b ${dark ? "border-gray-800" : "border-gray-200"} text-xs uppercase ${mutedText}`}>
                        <th className="py-3">Zeit</th>
                        <th>Buch</th>
                        <th>Typ</th>
                        <th>Menge</th>
                        <th>Preis</th>
                        <th>Gesamt</th>
                        <th>Grund</th>
                        <th>Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td className={`py-4 ${mutedText}`} colSpan={8}>
                            Keine passenden Einträge gefunden.
                          </td>
                        </tr>
                      ) : (
                        filteredHistory.slice(0, 200).map((entry) => (
                          <tr key={entry.id} className={`border-b ${dark ? "border-gray-800" : "border-gray-200"} last:border-b-0`}>
                            <td className="py-3">{new Date(entry.createdAt).toLocaleString("de-DE")}</td>
                            <td>{entry.bookName}</td>
                            <td>{entry.type}</td>
                            <td>{entry.quantity}</td>
                            <td>€{entry.unitPrice.toFixed(2)}</td>
                            <td className={entry.total >= 0 ? "text-emerald-400" : "text-amber-400"}>€{Math.abs(entry.total).toFixed(2)}</td>
                            <td>{entry.reason}</td>
                            <td>
                              {entry.type === "Verkauf" && (
                                <Button size="sm" variant="outline" onClick={() => prepareReturn(entry)}>
                                  In Kasse öffnen
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricField({
  label,
  value,
  active,
  onClick,
  dark,
  disabled = false,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
  dark: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-4 py-4 text-left transition ${
        disabled
          ? dark
            ? "cursor-not-allowed border-gray-800 bg-gray-950 text-gray-500"
            : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
          : active
            ? "border-blue-500 bg-blue-500/10"
            : dark
              ? "border-gray-700 bg-gray-900 hover:bg-gray-800"
              : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className={`text-xs uppercase tracking-wide ${dark ? "text-gray-400" : "text-gray-500"}`}>{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value || "0"}</div>
    </button>
  );
}

function SummaryRow({ label, value, mutedText, strong = false }: { label: string; value: string; mutedText: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={mutedText}>{label}</span>
      <span className={strong ? "text-lg font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function InfoTile({ label, value, mutedText }: { label: string; value: string; mutedText: string }) {
  return (
    <div>
      <div className={`text-xs uppercase tracking-wide ${mutedText}`}>{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
