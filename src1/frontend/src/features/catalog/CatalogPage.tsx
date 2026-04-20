import { useEffect, useMemo, useState } from "react";

import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mapCatalogProductApi, mapProductSupplierLinkApi } from "@/lib/mappers";
import type {
  CatalogProduct,
  CatalogProductApi,
  CatalogProductDraft,
  ProductSupplierLink,
  ProductSupplierLinkApi,
  ProductSupplierLinkDraft,
  Supplier,
} from "@/types";

interface CatalogPageProps {
  card: string;
  dark: boolean;
  products: CatalogProduct[];
  suppliers: Supplier[];
  reloadProducts: () => Promise<void>;
}

const EMPTY_DRAFT: CatalogProductDraft = {
  sku: "",
  title: "",
  author: "",
  description: "",
  category: "",
  sellingPrice: "",
  reorderPoint: "0",
};

export function CatalogPage({ card, dark, products, suppliers, reloadProducts }: CatalogPageProps) {
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CatalogProductDraft>(EMPTY_DRAFT);
  const [supplierLinks, setSupplierLinks] = useState<ProductSupplierLinkDraft[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = dark
    ? "w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const borderClass = dark ? "border-gray-800" : "border-gray-200";
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.title, product.author, product.category, product.description, product.sku].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [products, search]);

  useEffect(() => {
    if (!selectedProduct) {
      setSupplierLinks([]);
      return;
    }
    let cancelled = false;
    setLoadingLinks(true);
    apiGet<ProductSupplierLinkApi[]>(`/product-suppliers/${selectedProduct.id}`)
      .then((rows) => {
        if (cancelled) return;
        const mapped = rows.map(mapProductSupplierLinkApi);
        setSupplierLinks(
          mapped.map((link) => ({
            supplierId: link.supplierId,
            supplierSku: link.supplierSku,
            isPrimary: link.isPrimary,
            lastPurchasePrice: String(link.lastPurchasePrice),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setSupplierLinks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLinks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProduct?.id]);

  const openNewProduct = () => {
    setSelectedProductId(null);
    setDraft(EMPTY_DRAFT);
    setSupplierLinks([]);
    setError(null);
  };

  const openProduct = (product: CatalogProduct) => {
    setSelectedProductId(product.id);
    setDraft({
      sku: product.sku,
      title: product.title,
      author: product.author,
      description: product.description,
      category: product.category,
      sellingPrice: String(product.sellingPrice),
      reorderPoint: String(product.reorderPoint),
    });
    setError(null);
  };

  const saveProduct = async () => {
    setSaving(true);
    setError(null);
    try {
      let currentProduct = selectedProduct;
      if (!selectedProduct) {
        const created = await apiPost<CatalogProductApi, Record<string, string | number>>("/catalog-products", {
          sku: draft.sku.trim(),
          title: draft.title.trim(),
          author: draft.author.trim(),
          description: draft.description.trim(),
          category: draft.category.trim(),
          selling_price: Number(draft.sellingPrice) || 0,
          reorder_point: Math.max(0, Number(draft.reorderPoint) || 0),
        });
        currentProduct = mapCatalogProductApi(created);
        setSelectedProductId(currentProduct.id);
      } else {
        const updated = await apiPut<CatalogProductApi, Record<string, string | number | boolean>>(
          `/catalog-products/${selectedProduct.id}`,
          {
            title: draft.title.trim(),
            author: draft.author.trim(),
            description: draft.description.trim(),
            category: draft.category.trim(),
            selling_price: Number(draft.sellingPrice) || 0,
            reorder_point: Math.max(0, Number(draft.reorderPoint) || 0),
            is_active: true,
          },
        );
        currentProduct = mapCatalogProductApi(updated);
      }

      const cleanedLinks = supplierLinks
        .filter((link) => link.supplierId.trim() !== "")
        .map((link) => ({
          supplier_id: link.supplierId.trim(),
          supplier_sku: link.supplierSku.trim(),
          is_primary: link.isPrimary,
          last_purchase_price: Math.max(0, Number(link.lastPurchasePrice) || 0),
        }));

      if (currentProduct) {
        await apiPut<ProductSupplierLinkApi[], { links: typeof cleanedLinks }>(
          `/product-suppliers/${currentProduct.id}`,
          { links: cleanedLinks },
        );
      }

      await reloadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Katalogprodukt konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!selectedProduct) return;
    setDeleting(true);
    setError(null);
    try {
      await apiDelete(`/catalog-products/${selectedProduct.id}`);
      setSelectedProductId(null);
      setDraft(EMPTY_DRAFT);
      setSupplierLinks([]);
      await reloadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Produkt konnte nicht entfernt werden.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      <Card className={card}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Katalogprodukte</h2>
              <p className={`mt-1 text-sm ${mutedText}`}>Stammdaten, Verkaufspreis und Lieferantenbezüge bleiben vom Lagerbestand getrennt.</p>
            </div>
            <Button onClick={openNewProduct}>Neues Produkt</Button>
          </div>

          <div className="mt-5">
            <input
              placeholder="Suche nach Titel, Autor, Kategorie oder SKU..."
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => openProduct(product)}
                className={`rounded-3xl border p-4 text-left transition ${selectedProductId === product.id ? "border-blue-500/70 bg-blue-500/10" : dark ? "border-gray-800 bg-gray-950/60 hover:border-blue-500/50" : "border-gray-200 bg-gray-50 hover:border-blue-300"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">{product.title}</div>
                    <div className={`mt-1 text-sm ${mutedText}`}>{product.author || "Autor unbekannt"}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${product.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-500/15 text-gray-400"}`}>
                    {product.isActive ? "Aktiv" : "Inaktiv"}
                  </div>
                </div>
                <div className={`mt-3 grid gap-1 text-sm ${mutedText}`}>
                  <div>SKU: {product.sku}</div>
                  <div>Kategorie: {product.category || "-"}</div>
                  <div>VK: €{product.sellingPrice.toFixed(2)} · Meldebestand: {product.reorderPoint}</div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold">{selectedProduct ? "Produkt bearbeiten" : "Produkt anlegen"}</h3>
          <p className={`mt-1 text-sm ${mutedText}`}>Der Bestand je Lagerort wird separat unter Bestand & Ledger verwaltet.</p>

          <div className="mt-4 grid gap-3">
            <input className={inputClass} placeholder="SKU" value={draft.sku} onChange={(e) => setDraft((prev) => ({ ...prev, sku: e.target.value }))} />
            <input className={inputClass} placeholder="Titel" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
            <input className={inputClass} placeholder="Autor" value={draft.author} onChange={(e) => setDraft((prev) => ({ ...prev, author: e.target.value }))} />
            <input className={inputClass} placeholder="Kategorie" value={draft.category} onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))} />
            <input className={inputClass} placeholder="Verkaufspreis" inputMode="decimal" value={draft.sellingPrice} onChange={(e) => setDraft((prev) => ({ ...prev, sellingPrice: e.target.value }))} />
            <input className={inputClass} placeholder="Meldebestand" inputMode="numeric" value={draft.reorderPoint} onChange={(e) => setDraft((prev) => ({ ...prev, reorderPoint: e.target.value }))} />
            <textarea className={`${inputClass} min-h-24`} placeholder="Beschreibung" value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
          </div>

          <div className={`mt-5 rounded-3xl border p-4 ${borderClass}`}>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Lieferantenverknüpfungen</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSupplierLinks((prev) => [
                    ...prev,
                    { supplierId: suppliers[0]?.id ?? "", supplierSku: "", isPrimary: prev.length === 0, lastPurchasePrice: "0" },
                  ])
                }
              >
                Zeile hinzufügen
              </Button>
            </div>
            {loadingLinks ? <p className={`mt-3 text-sm ${mutedText}`}>Lade Lieferanten...</p> : null}
            <div className="mt-3 space-y-3">
              {supplierLinks.length === 0 ? <p className={`text-sm ${mutedText}`}>Noch keine Lieferanten hinterlegt.</p> : null}
              {supplierLinks.map((link, index) => (
                <div key={`${link.supplierId}-${index}`} className="grid gap-2 rounded-2xl border p-3 md:grid-cols-[1.3fr_1fr_1fr_auto]">
                  <select
                    className={inputClass}
                    value={link.supplierId}
                    onChange={(e) => setSupplierLinks((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, supplierId: e.target.value } : row))}
                  >
                    <option value="">Lieferant wählen</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <input className={inputClass} placeholder="Supplier SKU" value={link.supplierSku} onChange={(e) => setSupplierLinks((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, supplierSku: e.target.value } : row))} />
                  <input className={inputClass} placeholder="EK zuletzt" value={link.lastPurchasePrice} onChange={(e) => setSupplierLinks((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, lastPurchasePrice: e.target.value } : row))} />
                  <div className="flex items-center gap-2">
                    <label className={`text-sm ${mutedText}`}>
                      <input
                        type="checkbox"
                        checked={link.isPrimary}
                        onChange={(e) =>
                          setSupplierLinks((prev) =>
                            prev.map((row, rowIndex) => ({
                              ...row,
                              isPrimary: rowIndex === index ? e.target.checked : e.target.checked ? false : row.isPrimary,
                            })),
                          )
                        }
                      />{" "}
                      Primär
                    </label>
                    <Button variant="outline" size="sm" onClick={() => setSupplierLinks((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>
                      Entfernen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={saveProduct} disabled={saving}>
              {saving ? "Speichere..." : selectedProduct ? "Produkt speichern" : "Produkt anlegen"}
            </Button>
            {selectedProduct ? (
              <Button variant="destructive" onClick={deleteProduct} disabled={deleting}>
                {deleting ? "Entferne..." : "Aus Katalog entfernen"}
              </Button>
            ) : null}
          </div>
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
