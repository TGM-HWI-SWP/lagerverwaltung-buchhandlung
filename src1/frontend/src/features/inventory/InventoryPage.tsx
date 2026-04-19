import { useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Book, EditBookDraft, AppSettings } from "@/types";
import { mapBookApiToBook, mapDraftToBookPayload } from "@/lib/mappers";
import { apiGet, apiPut, apiDelete } from "@/api/client";

interface InventoryPageProps {
  card: string;
  books: Book[];
  setBooks: Dispatch<SetStateAction<Book[]>>;
  loading: boolean;
  error: string | null;
  dark: boolean;
  settings: AppSettings;
  updateBookInState: (book: Book) => void;
}

export function InventoryPage({
  card,
  books,
  setBooks,
  loading,
  error,
  dark,
  settings,
  updateBookInState,
}: InventoryPageProps) {
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  const inputClass = dark
    ? "w-80 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-80 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const lowStockText = dark ? "text-amber-300" : "text-amber-700";
  const rowPaddingClass = "py-2";
  const modalInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const openEditModal = (book: Book) => {
    setEditingBookId(book.id);
    setEditDraft({
      name: book.name,
      author: book.author,
      description: book.description,
      purchasePrice: String(book.purchasePrice || book.price || 0),
      sellingPrice: String(book.sellingPrice || book.price || 0),
      quantity: String(book.quantity),
      sku: book.sku,
      category: book.category,
      supplierId: "",
      notes: book.notes ?? "",
    });
    setEditError(null);
    setDeleteConfirm(false);
    setEditOpen(true);
  };

  const onEditSave = async () => {
    if (!editingBookId) return;
    setEditing(true);
    setEditError(null);
    try {
      const updated = await apiPut<Book, Record<string, string | number | null>>(
        `/books/${editingBookId}`,
        mapDraftToBookPayload(editDraft, { id: editingBookId }),
      );
      updateBookInState(updated);
      setEditOpen(false);
      setEditingBookId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setEditing(false);
    }
  };

  const onDelete = async () => {
    if (!editingBookId) return;
    setDeleting(true);
    setEditError(null);
    try {
      await apiDelete(`/books/${editingBookId}`);
      setBooks((prev) => prev.filter((book) => book.id !== editingBookId));
      setEditOpen(false);
      setEditingBookId(null);
      setDeleteConfirm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Das Buch konnte nicht gelöscht werden.";
      setEditError(message);
    } finally {
      setDeleting(false);
    }
  };

  const startDeleteFlow = async () => {
    if (settings.confirmDelete) {
      setDeleteConfirm(true);
      return;
    }
    await onDelete();
  };

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return books;
    return books.filter(
      (book) =>
        book.name.toLowerCase().includes(query) ||
        book.sku.toLowerCase().includes(query) ||
        book.category.toLowerCase().includes(query),
    );
  }, [books, search]);

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Bücherverwaltung</h2>

          <div className="mb-4 flex flex-wrap gap-3">
            <input
              placeholder="Suche nach Name, SKU oder Kategorie..."
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outline" onClick={() => setSearch("")}>Zurücksetzen</Button>
          </div>

          {editOpen && (
            <div className={`mb-6 rounded-xl border p-4 ${tableBorder}`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">Buch bearbeiten</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditOpen(false);
                    setDeleteConfirm(false);
                    setEditError(null);
                  }}
                >
                  Schließen
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  className={modalInputClass}
                  placeholder="Name *"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Autor"
                  value={editDraft.author}
                  onChange={(e) => setEditDraft((d) => ({ ...d, author: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Kategorie"
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="SKU (Auto-generiert)"
                  value={editDraft.sku}
                  onChange={(e) => setEditDraft((d) => ({ ...d, sku: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Einkaufspreis (EUR)"
                  inputMode="decimal"
                  value={editDraft.purchasePrice}
                  onChange={(e) => setEditDraft((d) => ({ ...d, purchasePrice: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Verkaufspreis (EUR)"
                  inputMode="decimal"
                  value={editDraft.sellingPrice}
                  onChange={(e) => setEditDraft((d) => ({ ...d, sellingPrice: e.target.value }))}
                />
                <input
                  className={modalInputClass}
                  placeholder="Bestand (Stück)"
                  inputMode="numeric"
                  value={editDraft.quantity}
                  onChange={(e) => setEditDraft((d) => ({ ...d, quantity: e.target.value }))}
                />
                <input
                  className={`${modalInputClass} md:col-span-2`}
                  placeholder="Beschreibung"
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                />
                <input
                  className={`${modalInputClass} md:col-span-2`}
                  placeholder="Notizen"
                  value={editDraft.notes}
                  onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button onClick={onEditSave} disabled={editing || editDraft.name.trim().length === 0}>
                  {editing ? "Speichere..." : "Änderungen speichern"}
                </Button>
                {!deleteConfirm ? (
                  <Button variant="destructive" onClick={startDeleteFlow}>
                    Löschen
                  </Button>
                ) : (
                  <>
                    <span className="text-sm text-red-400">Wirklich löschen?</span>
                    <Button variant="destructive" onClick={onDelete} disabled={deleting}>
                      {deleting ? "Lösche..." : "Ja, löschen"}
                    </Button>
                    <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                      Abbrechen
                    </Button>
                  </>
                )}
                {editError && <span className="text-sm text-red-400">{editError}</span>}
              </div>
            </div>
          )}

          {loading && <p className={`text-sm ${mutedText}`}>Lade Bücher…</p>}
          {error && <p className="text-sm text-red-400">Fehler beim Laden der Bücher: {error}</p>}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="mt-2 min-w-full text-left text-sm">
                <thead>
                  <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                    <th className="py-2">Buch</th>
                    <th>Kategorie</th>
                    <th>Beschreibung</th>
                    <th>Verkaufspreis</th>
                    <th>Bestand</th>
                    <th>Notiz</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.length === 0 && (
                    <tr>
                      <td className={`py-4 ${mutedText}`} colSpan={6}>
                        Keine passenden Bücher vorhanden.
                      </td>
                    </tr>
                  )}
                  {filteredBooks.map((book) => (
                    <tr key={book.id} className={`border-b ${tableBorder} last:border-b-0`}>
                      <td className={rowPaddingClass}>
                        <div className="font-medium">{book.name}</div>
                        {!!book.author && <div className={`text-xs ${mutedText}`}>{book.author}</div>}
                        <div className={`text-xs ${mutedText}`}>{book.sku || "ohne SKU"}</div>
                      </td>
                      <td>{book.category || "-"}</td>
                      <td className={rowPaddingClass}>{book.description || "-"}</td>
                      <td>€{(book.sellingPrice || book.price || 0).toFixed(2)}</td>
                      <td className={book.quantity <= settings.lowStockThreshold ? lowStockText : ""}>
                        <div className="flex items-center justify-between gap-3">
                          <span>{book.quantity}</span>
                          <Button size="sm" variant="outline" onClick={() => openEditModal(book)}>
                            Bearbeiten
                          </Button>
                        </div>
                      </td>
                      <td className={rowPaddingClass}>{book.notes || "-"}</td>
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
