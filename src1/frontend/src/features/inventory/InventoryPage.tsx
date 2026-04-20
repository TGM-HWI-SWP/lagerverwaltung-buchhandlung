import { useMemo, useState } from "react";

import { apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocationAutocomplete } from "@/features/locations/LocationAutocomplete";
import type { AppSettings, CatalogProduct, StockEntry, StockLedgerEntry, Warehouse } from "@/types";

interface InventoryPageProps {
  card: string;
  dark: boolean;
  settings: AppSettings;
  products: CatalogProduct[];
  stockEntries: StockEntry[];
  ledgerEntries: StockLedgerEntry[];
  warehouses: Warehouse[];
  loading: boolean;
  error: string | null;
  reloadWarehouses: () => Promise<void>;
  reloadStockEntries: () => Promise<void>;
  reloadLedgerEntries: () => Promise<void>;
}

export function InventoryPage({
  card,
  dark,
  settings,
  products,
  stockEntries,
  ledgerEntries,
  warehouses,
  loading,
  error,
  reloadWarehouses,
  reloadStockEntries,
  reloadLedgerEntries,
}: InventoryPageProps) {
  const [search, setSearch] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [productId, setProductId] = useState("");
  const [quantityDelta, setQuantityDelta] = useState("");
  const [reason, setReason] = useState("Bestandskorrektur");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creatingWarehouse, setCreatingWarehouse] = useState(false);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [warehouseDraft, setWarehouseDraft] = useState({
    code: "",
    name: "",
    locationDisplayName: "",
    locationStreet: "",
    locationHouseNumber: "",
    locationPostcode: "",
    locationCity: "",
    locationState: "",
    locationCountry: "",
    locationLat: "",
    locationLon: "",
  });

  const inputClass = dark
    ? "w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500";
  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stockEntries.filter((entry) => {
      if (warehouseCode && entry.warehouseCode !== warehouseCode) return false;
      if (!query) return true;
      return [entry.title, entry.sku, entry.warehouseCode].some((value) => value.toLowerCase().includes(query));
    });
  }, [search, stockEntries, warehouseCode]);

  const submitAdjustment = async () => {
    if (!productId) {
      setSaveError("Bitte zuerst ein Produkt auswählen.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiPost("/stock-adjustments", {
        product_id: productId,
        warehouse_code: warehouseCode || "STORE",
        quantity_delta: Number(quantityDelta) || 0,
        reason: reason.trim() || "Bestandskorrektur",
      });
      setQuantityDelta("");
      setReason("Bestandskorrektur");
      await Promise.all([reloadStockEntries(), reloadLedgerEntries()]);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Bestandskorrektur fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const createWarehouse = async () => {
    setCreatingWarehouse(true);
    setWarehouseError(null);
    try {
      await apiPost("/warehouses", {
        code: warehouseDraft.code.trim(),
        name: warehouseDraft.name.trim(),
        location_display_name: warehouseDraft.locationDisplayName.trim(),
        location_street: warehouseDraft.locationStreet.trim(),
        location_house_number: warehouseDraft.locationHouseNumber.trim(),
        location_postcode: warehouseDraft.locationPostcode.trim(),
        location_city: warehouseDraft.locationCity.trim(),
        location_state: warehouseDraft.locationState.trim(),
        location_country: warehouseDraft.locationCountry.trim(),
        location_lat: warehouseDraft.locationLat.trim(),
        location_lon: warehouseDraft.locationLon.trim(),
        location_source: "manual",
        location_source_id: "",
      });
      setWarehouseDraft({
        code: "",
        name: "",
        locationDisplayName: "",
        locationStreet: "",
        locationHouseNumber: "",
        locationPostcode: "",
        locationCity: "",
        locationState: "",
        locationCountry: "",
        locationLat: "",
        locationLon: "",
      });
      await reloadWarehouses();
    } catch (err) {
      setWarehouseError(err instanceof Error ? err.message : "Lagerort konnte nicht angelegt werden.");
    } finally {
      setCreatingWarehouse(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Bestände je Lagerort</h2>
              <p className={`mt-1 text-sm ${mutedText}`}>Der aktuelle Bestand liegt ausschließlich in den Lagerpositionen. Darunter siehst du das Ledger als Historie.</p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-gray-50"}`}>
              Meldebestand: unter {settings.lowStockThreshold} Stk.
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <input className={inputClass} placeholder="Suche nach Titel, SKU oder Lagerort..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={inputClass} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)}>
              <option value="">Alle Lagerorte</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.code}>
                  {warehouse.code} · {warehouse.name} · {[warehouse.locationCity, warehouse.locationCountry].filter(Boolean).join(", ")}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={() => setSearch("")}>
              Filter leeren
            </Button>
          </div>

          <div className={`mt-5 rounded-3xl border p-4 ${dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-gray-50"}`}>
            <h3 className="text-lg font-semibold">Bestandskorrektur</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto]">
              <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Produkt wählen</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)}>
                <option value="">STORE</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.code}>
                    {warehouse.code}
                  </option>
                ))}
              </select>
              <input className={inputClass} placeholder="+ / - Menge" inputMode="numeric" value={quantityDelta} onChange={(e) => setQuantityDelta(e.target.value)} />
              <input className={inputClass} placeholder="Grund" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button onClick={submitAdjustment} disabled={saving}>
                {saving ? "Buche..." : "Buchen"}
              </Button>
            </div>
            {saveError ? <p className="mt-3 text-sm text-red-400">{saveError}</p> : null}
          </div>

          <div className={`mt-5 rounded-3xl border p-4 ${dark ? "border-gray-800 bg-gray-950/60" : "border-gray-200 bg-gray-50"}`}>
            <h3 className="text-lg font-semibold">Lagerort anlegen</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input className={inputClass} placeholder="Code *" value={warehouseDraft.code} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
              <input className={inputClass} placeholder="Name *" value={warehouseDraft.name} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, name: e.target.value }))} />
              <LocationAutocomplete
                dark={dark}
                label="Standort suchen"
                value={warehouseDraft.locationDisplayName}
                onChange={(value) => setWarehouseDraft((prev) => ({ ...prev, locationDisplayName: value }))}
                onSelect={(location) =>
                  setWarehouseDraft((prev) => ({
                    ...prev,
                    locationDisplayName: location.displayName,
                    locationStreet: location.street,
                    locationHouseNumber: location.houseNumber,
                    locationPostcode: location.postcode,
                    locationCity: location.city,
                    locationState: location.state,
                    locationCountry: location.country,
                    locationLat: location.lat,
                    locationLon: location.lon,
                  }))
                }
              />
              <input className={inputClass} placeholder="Straße" value={warehouseDraft.locationStreet} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, locationStreet: e.target.value }))} />
              <input className={inputClass} placeholder="Hausnummer" value={warehouseDraft.locationHouseNumber} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, locationHouseNumber: e.target.value }))} />
              <input className={inputClass} placeholder="PLZ" value={warehouseDraft.locationPostcode} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, locationPostcode: e.target.value }))} />
              <input className={inputClass} placeholder="Stadt *" value={warehouseDraft.locationCity} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, locationCity: e.target.value }))} />
              <input className={inputClass} placeholder="Bundesland/Region" value={warehouseDraft.locationState} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, locationState: e.target.value }))} />
              <input className={inputClass} placeholder="Land *" value={warehouseDraft.locationCountry} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, locationCountry: e.target.value }))} />
              <input className={inputClass} placeholder="Breitengrad" value={warehouseDraft.locationLat} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, locationLat: e.target.value }))} />
              <input className={inputClass} placeholder="Längengrad" value={warehouseDraft.locationLon} onChange={(e) => setWarehouseDraft((prev) => ({ ...prev, locationLon: e.target.value }))} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={createWarehouse} disabled={creatingWarehouse || warehouseDraft.code.trim() === "" || warehouseDraft.name.trim() === "" || warehouseDraft.locationCity.trim() === "" || warehouseDraft.locationCountry.trim() === ""}>
                {creatingWarehouse ? "Speichere..." : "Lagerort anlegen"}
              </Button>
              {warehouseError ? <span className="text-sm text-red-400">{warehouseError}</span> : null}
            </div>
          </div>

          {loading ? <p className={`mt-4 text-sm ${mutedText}`}>Lade Bestände...</p> : null}
          {error ? <p className="mt-4 text-sm text-red-400">Fehler: {error}</p> : null}

          {!loading && !error ? (
            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={`border-b ${tableBorder} text-xs uppercase ${mutedText}`}>
                    <th className="py-3">Produkt</th>
                    <th>Lagerort</th>
                    <th>SKU</th>
                    <th>Bestand</th>
                    <th>Reserviert</th>
                    <th>Meldebestand</th>
                    <th>VK</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={`${entry.productId}-${entry.warehouseCode}`} className={`border-b ${tableBorder} last:border-b-0`}>
                      <td className="py-3 font-medium">{entry.title}</td>
                      <td>{warehouses.find((warehouse) => warehouse.code === entry.warehouseCode)?.locationDisplayName || entry.warehouseCode}</td>
                      <td className="font-mono text-xs">{entry.sku}</td>
                      <td className={entry.onHand <= Math.max(settings.lowStockThreshold, entry.reorderPoint) ? "text-amber-400" : ""}>{entry.onHand}</td>
                      <td>{entry.reserved}</td>
                      <td>{entry.reorderPoint}</td>
                      <td>€{entry.sellingPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold">Stock Ledger</h3>
          <p className={`mt-1 text-sm ${mutedText}`}>Jede Bestandsänderung wird als eigener Ledger-Eintrag gespeichert und bleibt nachvollziehbar.</p>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className={`border-b ${tableBorder} text-xs uppercase ${mutedText}`}>
                  <th className="py-3">Zeit</th>
                  <th>Produkt</th>
                  <th>Lagerort</th>
                  <th>Delta</th>
                  <th>Typ</th>
                  <th>Referenz</th>
                  <th>Grund</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className={`border-b ${tableBorder} last:border-b-0`}>
                    <td className="py-3">{new Date(entry.createdAt).toLocaleString("de-DE")}</td>
                    <td>{entry.title}</td>
                    <td>{entry.warehouseCode}</td>
                    <td className={entry.quantityDelta >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {entry.quantityDelta > 0 ? `+${entry.quantityDelta}` : entry.quantityDelta}
                    </td>
                    <td>{entry.movementType}</td>
                    <td>{entry.referenceType}{entry.referenceId ? ` · ${entry.referenceId}` : ""}</td>
                    <td>{entry.reason}</td>
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
