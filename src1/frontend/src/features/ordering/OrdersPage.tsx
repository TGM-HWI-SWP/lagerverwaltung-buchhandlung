import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Book, NewBookDraft, ReorderDraft, PurchaseOrder, Supplier, IncomingDelivery } from "@/types";
import { mapDraftToBookPayload, mapPurchaseOrderApiToOrder, mapIncomingDeliveryApi } from "@/lib/mappers";
import { apiGet, apiPost } from "@/api/client";

interface OrdersPageProps {
  card: string;
  dark: boolean;
  books: Book[];
  addBookToState: (book: Book) => void;
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  setOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  setIncomingDeliveries: React.Dispatch<React.SetStateAction<IncomingDelivery[]>>;
  reloadOrders: () => void;
  reloadIncomingDeliveries: () => void;
}

export function OrdersPage({
  card,
  dark,
  books,
  addBookToState,
  suppliers,
  orders,
  setOrders,
  setIncomingDeliveries,
  reloadOrders,
  reloadIncomingDeliveries,
}: OrdersPageProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingBook, setCreatingBook] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [bookDraft, setBookDraft] = useState<NewBookDraft>({
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
  const [draft, setDraft] = useState<ReorderDraft>({
    bookId: "",
    supplierId: "",
    quantity: "1",
    unitPrice: "",
  });

  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const formInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const selectedBook = useMemo(
    () => books.find((entry) => entry.id === draft.bookId) ?? null,
    [books, draft.bookId],
  );

  const openOrders = useMemo(
    () => orders.filter((order) => order.status !== "geliefert"),
    [orders],
  );

  useEffect(() => {
    if (!selectedBook) {
      return;
    }
    setDraft((prev) => ({
      ...prev,
      supplierId: prev.supplierId || selectedBook.supplierId || suppliers[0]?.id || "",
      unitPrice: prev.unitPrice || String(selectedBook.purchasePrice || 0),
    }));
  }, [selectedBook, suppliers]);

  const onCreateBook = async () => {
    setBookError(null);
    setCreatingBook(true);
    try {
      const initialOrderQuantity = Math.max(0, Number(bookDraft.quantity) || 0);
      const supplierId = bookDraft.supplierId.trim() || suppliers[0]?.id || "";
      if (initialOrderQuantity > 0 && supplierId === "") {
        setBookError("Für eine Erstbestellung braucht das Buch einen Lieferanten.");
        return;
      }
      const createdBook = await apiPost<Book, Record<string, string | number | null>>(
        "/books",
        {
          ...mapDraftToBookPayload(bookDraft),
          quantity: 0,
        },
      );
      addBookToState(createdBook);
      if (initialOrderQuantity > 0) {
        const createdOrder = await apiPost<PurchaseOrder, Record<string, string | number>>(
          "/purchase-orders",
          {
            supplier_id: createdBook.supplierId || supplierId,
            book_id: createdBook.id,
            book_name: createdBook.name,
            book_sku: createdBook.sku,
            unit_price: createdBook.purchasePrice,
            quantity: initialOrderQuantity,
          },
        );
        setOrders((prev) => [mapPurchaseOrderApiToOrder(createdOrder), ...prev]);
      }
      setBookDraft({
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
      setCreateOpen(false);
    } catch (err) {
      setBookError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setCreatingBook(false);
    }
  };

  const createReorder = async () => {
    setOrderError(null);
    setCreatingOrder(true);
    try {
      if (!selectedBook) {
        setOrderError("Bitte ein Buch aus dem Lager auswählen.");
        return;
      }
      const quantity = Number(draft.quantity);
      const unitPrice = Number(draft.unitPrice);
      const selectedSupplier =
        suppliers.find((supplier) => supplier.id === draft.supplierId) ?? null;

      if (!selectedSupplier) {
        setOrderError("Bitte einen Lieferanten auswählen.");
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setOrderError("Bitte eine gültige Nachbestellmenge > 0 eingeben.");
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setOrderError("Bitte einen gültigen Einkaufspreis >= 0 eingeben.");
        return;
      }

      const createdOrder = await apiPost<PurchaseOrder, Record<string, string | number>>(
        "/purchase-orders",
        {
          supplier_id: selectedSupplier.id,
          book_id: selectedBook.id,
          book_name: selectedBook.name,
          book_sku: selectedBook.sku,
          unit_price: unitPrice,
          quantity: Math.round(quantity),
        },
      );

      setOrders((prev) => [mapPurchaseOrderApiToOrder(createdOrder), ...prev]);
      setDraft({
        bookId: "",
        supplierId: "",
        quantity: "1",
        unitPrice: "",
      });
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setCreatingOrder(false);
    }
  };

  const receiveOrder = async (orderId: string) => {
    setOrderError(null);
    const order = orders.find((entry) => entry.id === orderId);
    if (!order || !order.supplierId) {
      return;
    }

    const remainingQuantity = order.quantity - order.deliveredQuantity;
    const receivedQuantity = Number(receivedDrafts[orderId] || remainingQuantity);
    if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) {
      setOrderError("Bitte eine gültige Liefermenge > 0 eingeben.");
      return;
    }
    if (receivedQuantity > remainingQuantity) {
      setOrderError("Die Teil-Lieferung darf nicht größer als die offene Restmenge sein.");
      return;
    }

    try {
      const createdDelivery = await apiPost<IncomingDelivery, { quantity: number }>(
        `/purchase-orders/${orderId}/receive`,
        { quantity: Math.round(receivedQuantity) },
      );
      setIncomingDeliveries((prev) => [mapIncomingDeliveryApi(createdDelivery), ...prev]);
      reloadOrders();
      reloadIncomingDeliveries();
      setReceivedDrafts((prev) => ({ ...prev, [orderId]: "" }));
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Bestellen</h2>
          <div className={`grid grid-cols-1 gap-3 rounded-xl border p-4 ${tableBorder} md:grid-cols-2`}>
            <button
              type="button"
              onClick={() => setCreateOpen((v) => !v)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                createOpen
                  ? dark
                    ? "border-blue-500/70 bg-blue-500/10"
                    : "border-blue-400 bg-blue-50"
                  : dark
                    ? "border-gray-700 bg-gray-950 hover:border-blue-500/50 hover:bg-blue-500/5"
                    : "border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <div className="mb-1 text-sm font-semibold">Erstbestellung anlegen</div>
              <p className={`text-sm ${mutedText}`}>
                Neue Titel mit erster Bestellung anlegen.
              </p>
            </button>
            <div className={`rounded-xl border p-4 ${dark ? "border-gray-700 bg-gray-950" : "border-gray-300 bg-white"}`}>
              <div className="mb-1 text-sm font-semibold">Nachbestellung anlegen</div>
              <p className={`mb-3 text-sm ${mutedText}`}>
                Bestehende Bücher neu bestellen und offen verfolgen.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className={formInputClass}
                  value={draft.bookId}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      bookId: e.target.value,
                      supplierId: "",
                      unitPrice: "",
                    }))
                  }
                >
                  <option value="">Buch aus Lager auswählen</option>
                  {books
                    .slice()
                    .sort((a, b) => (a.quantity - b.quantity) || a.name.localeCompare(b.name))
                    .map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.name} ({book.quantity} Stk.)
                      </option>
                    ))}
                </select>
                <select
                  className={formInputClass}
                  value={draft.supplierId}
                  onChange={(e) => setDraft((prev) => ({ ...prev, supplierId: e.target.value }))}
                >
                  <option value="">Lieferant auswählen</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <input
                  className={formInputClass}
                  type="number"
                  min={1}
                  placeholder="Menge"
                  value={draft.quantity}
                  onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                />
                <input
                  className={formInputClass}
                  inputMode="decimal"
                  placeholder="Einkaufspreis"
                  value={draft.unitPrice}
                  onChange={(e) => setDraft((prev) => ({ ...prev, unitPrice: e.target.value }))}
                />
                <div className="md:col-span-2">
                  <Button
                    onClick={createReorder}
                    disabled={creatingOrder || books.length === 0 || suppliers.length === 0}
                  >
                    {creatingOrder ? "Erfasse Bestellung..." : "Nachbestellung anlegen"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {createOpen && (
            <div className={`rounded-xl border p-4 ${tableBorder}`}>
              <h3 className="mb-1 text-base font-semibold">Erstbestellung anlegen</h3>
              <p className={`mb-4 text-sm ${mutedText}`}>
                Lege einen neuen Titel an. Die Erstmenge landet als offene Bestellung und wird später im Wareneingang eingebucht.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className={formInputClass} placeholder="Name *" value={bookDraft.name} onChange={(e) => setBookDraft((prev) => ({ ...prev, name: e.target.value }))} />
                <input className={formInputClass} placeholder="Autor" value={bookDraft.author} onChange={(e) => setBookDraft((prev) => ({ ...prev, author: e.target.value }))} />
                <input className={formInputClass} placeholder="Kategorie" value={bookDraft.category} onChange={(e) => setBookDraft((prev) => ({ ...prev, category: e.target.value }))} />
                <input className={formInputClass} placeholder="SKU (Auto-generiert)" value={bookDraft.sku} onChange={(e) => setBookDraft((prev) => ({ ...prev, sku: e.target.value }))} />
                <input className={formInputClass} placeholder="Einkaufspreis" inputMode="decimal" value={bookDraft.purchasePrice} onChange={(e) => setBookDraft((prev) => ({ ...prev, purchasePrice: e.target.value }))} />
                <input className={formInputClass} placeholder="Verkaufspreis" inputMode="decimal" value={bookDraft.sellingPrice} onChange={(e) => setBookDraft((prev) => ({ ...prev, sellingPrice: e.target.value }))} />
                <input className={formInputClass} placeholder="Erstbestellmenge" inputMode="numeric" value={bookDraft.quantity} onChange={(e) => setBookDraft((prev) => ({ ...prev, quantity: e.target.value }))} />
                <select className={formInputClass} value={bookDraft.supplierId} onChange={(e) => setBookDraft((prev) => ({ ...prev, supplierId: e.target.value }))}>
                  <option value="">Lieferant auswählen</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
                <input className={`${formInputClass} md:col-span-2`} placeholder="Beschreibung" value={bookDraft.description} onChange={(e) => setBookDraft((prev) => ({ ...prev, description: e.target.value }))} />
                <input className={`${formInputClass} md:col-span-2`} placeholder="Notizen" value={bookDraft.notes} onChange={(e) => setBookDraft((prev) => ({ ...prev, notes: e.target.value }))} />
              </div>
              <div className="mt-4">
                <Button onClick={onCreateBook} disabled={creatingBook || bookDraft.name.trim() === ""}>
                  {creatingBook ? "Speichere..." : "Erstbestellung speichern"}
                </Button>
                {bookError ? <span className="ml-3 text-sm text-red-400">{bookError}</span> : null}
              </div>
            </div>
          )}

          {orderError ? <p className="text-sm text-red-400">{orderError}</p> : null}

          <div className={`rounded-xl border p-4 ${tableBorder}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Offene Bestellungen</h3>
              <span className={`text-sm ${mutedText}`}>{openOrders.length} offen</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                    <th className="py-2">Lieferant</th>
                    <th>Buch</th>
                    <th>Bestellt</th>
                    <th>Offen</th>
                    <th>Preis</th>
                    <th>Lieferung</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.length === 0 && (
                    <tr>
                      <td className={`py-4 ${mutedText}`} colSpan={6}>
                        Aktuell keine offenen Bestellungen.
                      </td>
                    </tr>
                  )}
                  {openOrders.map((order) => (
                    <tr key={order.id} className={`border-b ${tableBorder} last:border-b-0`}>
                      <td className={rowPaddingClass}>{order.supplier}</td>
                      <td>{order.bookName}</td>
                      <td>{order.quantity}</td>
                      <td>{order.quantity - order.deliveredQuantity}</td>
                      <td>€{order.unitPrice?.toFixed(2) ?? "0.00"}</td>
                      <td className={rowPaddingClass}>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={order.quantity - order.deliveredQuantity}
                            className={`w-20 ${formInputClass}`}
                            placeholder="Menge"
                            value={receivedDrafts[order.id] || (order.quantity - order.deliveredQuantity)}
                            onChange={(e) => setReceivedDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          />
                          <Button size="sm" variant="outline" onClick={() => receiveOrder(order.id)}>
                            Einbuchen
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
