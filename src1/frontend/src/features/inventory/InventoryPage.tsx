import { useMemo, useState } from "react";

import { apiPut } from "@/api/client";
import { mapBookApiToBook } from "@/lib/mappers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppSettings, Book } from "@/types";

interface InventoryPageProps {
  card: string;
  books: Book[];
  loading: boolean;
  error: string | null;
  dark: boolean;
  settings: AppSettings;
  updateBookInState: (book: Book) => void;
}

export function InventoryPage({ card, books, loading, error, dark, settings, updateBookInState }: InventoryPageProps) {
  const [search, setSearch] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("0");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) ?? null, [books, selectedBookId]);
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const inputClass = dark
    ? "w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500";

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return books;
    return books.filter((book) =>
      [book.name, book.author, book.category, book.sku].some((value) => value.toLowerCase().includes(query)),
    );
  }, [books, search]);

  const openQuantityEditor = (book: Book) => {
    setSelectedBookId(book.id);
    setQuantityDraft(String(book.quantity));
    setSaveError(null);
  };

  const saveQuantity = async () => {
    if (!selectedBook) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiPut<Book, Record<string, string | number | null>>(`/books/${selectedBook.id}`, {
        id: selectedBook.id,
        name: selectedBook.name,
        author: selectedBook.author,
        description: selectedBook.description,
        purchase_price: selectedBook.purchasePrice,
        sell_price: selectedBook.sellingPrice,
        quantity: Math.max(0, Number(quantityDraft) || 0),
        sku: selectedBook.sku,
        category: selectedBook.category,
        supplier_id: selectedBook.supplierId ?? "",
        notes: selectedBook.notes ?? null,
      });
      updateBookInState(mapBookApiToBook(updated));
      setSelectedBookId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Bestand konnte nicht aktualisiert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Lagerbestand</h2>
              <p className={`mt-1 text-sm ${mutedText}`}>Im Lager wird nur der Bestand gepflegt. Stammdaten, Preise, Beschreibung und Notizen liegen im Katalog.</p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-gray-50"}`}>
              Niedrigbestand: unter {settings.lowStockThreshold} Stk.
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              placeholder="Suche nach Buch, Autor, Kategorie oder SKU..."
              className={`${inputClass} sm:max-w-md`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outline" onClick={() => setSearch("")}>
              Filter leeren
            </Button>
          </div>

          {selectedBook && (
            <div className={`mt-5 rounded-3xl border p-5 ${dark ? "border-gray-800 bg-gray-950/70" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedBook.name}</h3>
                  <p className={`mt-1 text-sm ${mutedText}`}>
                    {selectedBook.author || "Autor unbekannt"} · {selectedBook.category || "Ohne Kategorie"}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div>
                    <label className={`mb-2 block text-xs uppercase tracking-wide ${mutedText}`}>Neuer Bestand</label>
                    <input
                      className={`${inputClass} sm:w-40`}
                      inputMode="numeric"
                      value={quantityDraft}
                      onChange={(e) => setQuantityDraft(e.target.value)}
                    />
                  </div>
                  <Button onClick={saveQuantity} disabled={saving}>
                    {saving ? "Speichere..." : "Bestand speichern"}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedBookId(null)}>
                    Schließen
                  </Button>
                </div>
              </div>
              {saveError && <p className="mt-3 text-sm text-red-400">{saveError}</p>}
            </div>
          )}

          {loading && <p className={`mt-4 text-sm ${mutedText}`}>Lade Lagerbestand...</p>}
          {error && <p className="mt-4 text-sm text-red-400">Fehler beim Laden: {error}</p>}

          {!loading && !error && (
            <>
              <div className="mt-5 space-y-3 md:hidden">
                {filteredBooks.length === 0 ? (
                  <div className={`rounded-2xl border border-dashed p-4 text-sm ${mutedText}`}>Keine passenden Bücher gefunden.</div>
                ) : (
                  filteredBooks.map((book) => (
                    <div key={book.id} className={`rounded-2xl border p-4 ${dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-gray-50"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{book.name}</div>
                          <div className={`mt-1 text-sm ${mutedText}`}>{book.author || "Autor unbekannt"}</div>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${book.quantity <= settings.lowStockThreshold ? "bg-amber-500/15 text-amber-400" : dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-700"}`}>
                          {book.quantity} Stk.
                        </div>
                      </div>
                      <div className={`mt-3 grid grid-cols-2 gap-2 text-sm ${dark ? "text-gray-300" : "text-gray-700"}`}>
                        <div>Kategorie: {book.category || "-"}</div>
                        <div>SKU: {book.sku || "-"}</div>
                      </div>
                      <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => openQuantityEditor(book)}>
                        Bestand ändern
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className={`border-b ${tableBorder} text-xs uppercase ${mutedText}`}>
                      <th className="py-3">Buch</th>
                      <th>Autor</th>
                      <th>Kategorie</th>
                      <th>Bestand</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBooks.length === 0 ? (
                      <tr>
                        <td className={`py-4 ${mutedText}`} colSpan={5}>
                          Keine passenden Bücher gefunden.
                        </td>
                      </tr>
                    ) : (
                      filteredBooks.map((book) => (
                        <tr key={book.id} className={`border-b ${tableBorder} last:border-b-0`}>
                          <td className="py-3">
                            <div className="font-medium">{book.name}</div>
                            <div className={`text-xs ${mutedText}`}>{book.sku || "ohne SKU"}</div>
                          </td>
                          <td>{book.author || "-"}</td>
                          <td>{book.category || "-"}</td>
                          <td className={book.quantity <= settings.lowStockThreshold ? "text-amber-400" : ""}>{book.quantity}</td>
                          <td>
                            <Button size="sm" variant="outline" onClick={() => openQuantityEditor(book)}>
                              Bestand ändern
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
