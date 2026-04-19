import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { apiDelete, apiPut } from "@/api/client";
import { mapBookApiToBook, mapDraftToBookPayload } from "@/lib/mappers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Book, EditBookDraft } from "@/types";

interface CatalogPageProps {
  card: string;
  dark: boolean;
  books: Book[];
  setBooks: Dispatch<SetStateAction<Book[]>>;
  updateBookInState: (book: Book) => void;
}

export function CatalogPage({ card, dark, books, setBooks, updateBookInState }: CatalogPageProps) {
  const [search, setSearch] = useState("");
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editDraft, setEditDraft] = useState<EditBookDraft>({
    name: "",
    author: "",
    description: "",
    purchasePrice: "",
    sellingPrice: "",
    quantity: "",
    sku: "",
    category: "",
    supplierId: "",
    notes: "",
  });

  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const inputClass = dark
    ? "w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500";
  const selectedBook = books.find((book) => book.id === editingBookId) ?? null;

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return books;
    return books.filter((book) =>
      [book.name, book.author, book.category, book.description, book.notes ?? "", book.sku].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [books, search]);

  const openEditor = (book: Book) => {
    setEditingBookId(book.id);
    setDeleteConfirm(false);
    setEditError(null);
    setEditDraft({
      name: book.name,
      author: book.author,
      description: book.description,
      purchasePrice: String(book.purchasePrice || 0),
      sellingPrice: String(book.sellingPrice || 0),
      quantity: String(book.quantity),
      sku: book.sku,
      category: book.category,
      supplierId: book.supplierId ?? "",
      notes: book.notes ?? "",
    });
  };

  const saveBook = async () => {
    if (!editingBookId) return;
    setEditing(true);
    setEditError(null);
    try {
      const updated = await apiPut<Book, Record<string, string | number | null>>(
        `/books/${editingBookId}`,
        mapDraftToBookPayload(editDraft, { id: editingBookId }),
      );
      updateBookInState(mapBookApiToBook(updated));
      setEditingBookId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Katalogeintrag konnte nicht gespeichert werden.");
    } finally {
      setEditing(false);
    }
  };

  const deleteBook = async () => {
    if (!editingBookId) return;
    setDeleting(true);
    setEditError(null);
    try {
      await apiDelete(`/books/${editingBookId}`);
      setBooks((prev) => prev.filter((book) => book.id !== editingBookId));
      setEditingBookId(null);
      setDeleteConfirm(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Buch konnte nicht gelöscht werden.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Katalog</h2>
              <p className={`mt-1 text-sm ${mutedText}`}>Hier werden Stammdaten gepflegt: Titel, Preise, Beschreibung, Notizen, SKU und Lieferant. Entfernen eines Buchs passiert ebenfalls hier.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              placeholder="Suche nach Titel, Autor, SKU, Beschreibung oder Notiz..."
              className={`${inputClass} sm:max-w-xl`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outline" onClick={() => setSearch("")}>
              Filter leeren
            </Button>
          </div>

          {selectedBook && (
            <div className={`mt-5 rounded-3xl border p-5 ${dark ? "border-gray-800 bg-gray-950/70" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Katalogeintrag bearbeiten</h3>
                  <p className={`mt-1 text-sm ${mutedText}`}>Bestand wird im Lager gepflegt und bleibt hier nur sichtbar.</p>
                </div>
                <Button variant="outline" onClick={() => setEditingBookId(null)}>
                  Schließen
                </Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input className={inputClass} placeholder="Titel" value={editDraft.name} onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))} />
                <input className={inputClass} placeholder="Autor" value={editDraft.author} onChange={(e) => setEditDraft((prev) => ({ ...prev, author: e.target.value }))} />
                <input className={inputClass} placeholder="Kategorie" value={editDraft.category} onChange={(e) => setEditDraft((prev) => ({ ...prev, category: e.target.value }))} />
                <input className={inputClass} placeholder="SKU" value={editDraft.sku} onChange={(e) => setEditDraft((prev) => ({ ...prev, sku: e.target.value }))} />
                <input className={inputClass} placeholder="Einkaufspreis in EUR" value={editDraft.purchasePrice} onChange={(e) => setEditDraft((prev) => ({ ...prev, purchasePrice: e.target.value }))} />
                <input className={inputClass} placeholder="Verkaufspreis in EUR" value={editDraft.sellingPrice} onChange={(e) => setEditDraft((prev) => ({ ...prev, sellingPrice: e.target.value }))} />
                <input className={inputClass} placeholder="Lieferant-ID" value={editDraft.supplierId} onChange={(e) => setEditDraft((prev) => ({ ...prev, supplierId: e.target.value }))} />
                <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? "border-gray-700 bg-gray-900 text-gray-300" : "border-gray-200 bg-white text-gray-700"}`}>
                  Bestand aktuell: <span className="font-semibold">{selectedBook.quantity} Stk.</span>
                </div>
                <textarea className={`${inputClass} min-h-28 md:col-span-2`} placeholder="Beschreibung" value={editDraft.description} onChange={(e) => setEditDraft((prev) => ({ ...prev, description: e.target.value }))} />
                <textarea className={`${inputClass} min-h-24 md:col-span-2`} placeholder="Notizen" value={editDraft.notes} onChange={(e) => setEditDraft((prev) => ({ ...prev, notes: e.target.value }))} />
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <Button onClick={saveBook} disabled={editing}>
                  {editing ? "Speichere..." : "Katalog speichern"}
                </Button>
                {!deleteConfirm ? (
                  <Button variant="destructive" onClick={() => setDeleteConfirm(true)}>
                    Aus Katalog entfernen
                  </Button>
                ) : (
                  <>
                    <span className="text-sm text-red-400">Wirklich endgültig entfernen?</span>
                    <Button variant="destructive" onClick={deleteBook} disabled={deleting}>
                      {deleting ? "Lösche..." : "Ja, entfernen"}
                    </Button>
                    <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                      Abbrechen
                    </Button>
                  </>
                )}
              </div>
              {editError && <p className="mt-3 text-sm text-red-400">{editError}</p>}
            </div>
          )}

          <div className="mt-5 space-y-3 md:hidden">
            {filteredBooks.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-4 text-sm ${mutedText}`}>Keine Katalogeinträge gefunden.</div>
            ) : (
              filteredBooks.map((book) => (
                <div key={book.id} className={`rounded-2xl border p-4 ${dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{book.name}</div>
                      <div className={`mt-1 text-sm ${mutedText}`}>{book.author || "Autor unbekannt"}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openEditor(book)}>
                      Bearbeiten
                    </Button>
                  </div>
                  <div className={`mt-3 space-y-1 text-sm ${dark ? "text-gray-300" : "text-gray-700"}`}>
                    <div>SKU: {book.sku || "-"}</div>
                    <div>Kategorie: {book.category || "-"}</div>
                    <div>VK: €{book.sellingPrice.toFixed(2)} · EK: €{book.purchasePrice.toFixed(2)}</div>
                    <div>Beschreibung: {book.description || "-"}</div>
                    <div>Notiz: {book.notes || "-"}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className={`border-b ${tableBorder} text-xs uppercase ${mutedText}`}>
                  <th className="py-3">Titel</th>
                  <th>Autor</th>
                  <th>SKU</th>
                  <th>Kategorie</th>
                  <th>Preise</th>
                  <th>Beschreibung</th>
                  <th>Notizen</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td className={`py-4 ${mutedText}`} colSpan={8}>
                      Keine Katalogeinträge gefunden.
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map((book) => (
                    <tr key={book.id} className={`border-b ${tableBorder} last:border-b-0 align-top`}>
                      <td className="py-3 font-medium">{book.name}</td>
                      <td>{book.author || "-"}</td>
                      <td className="font-mono text-xs">{book.sku || "-"}</td>
                      <td>{book.category || "-"}</td>
                      <td>
                        <div>VK €{book.sellingPrice.toFixed(2)}</div>
                        <div className={mutedText}>EK €{book.purchasePrice.toFixed(2)}</div>
                      </td>
                      <td className="max-w-xs">{book.description || "-"}</td>
                      <td className="max-w-xs">{book.notes || "-"}</td>
                      <td>
                        <Button size="sm" variant="outline" onClick={() => openEditor(book)}>
                          Bearbeiten
                        </Button>
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
  );
}
