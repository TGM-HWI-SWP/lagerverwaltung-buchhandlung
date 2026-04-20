import { useState } from "react";

import { apiPost } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Supplier, SupplierDraft } from "@/types";

interface SuppliersPageProps {
  card: string;
  dark: boolean;
  suppliers: Supplier[];
  reloadSuppliers: () => Promise<void>;
}

export function SuppliersPage({ card, dark, suppliers, reloadSuppliers }: SuppliersPageProps) {
  const [creating, setCreating] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>({
    name: "",
    contact: "",
    address: "",
    locationDisplayName: "",
    locationStreet: "",
    locationHouseNumber: "",
    locationPostcode: "",
    locationCity: "",
    locationState: "",
    locationCountry: "",
    locationLat: "",
    locationLon: "",
    notes: "",
  });

  const formInputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const createSupplier = async () => {
    setSupplierError(null);
    setCreating(true);
    try {
      await apiPost<Supplier, Record<string, string | null>>("/suppliers", {
        id: "",
        name: draft.name.trim(),
        contact: draft.contact.trim(),
        address: draft.address.trim(),
        location_display_name: draft.locationDisplayName.trim(),
        location_street: draft.locationStreet.trim(),
        location_house_number: draft.locationHouseNumber.trim(),
        location_postcode: draft.locationPostcode.trim(),
        location_city: draft.locationCity.trim(),
        location_state: draft.locationState.trim(),
        location_country: draft.locationCountry.trim(),
        location_lat: draft.locationLat.trim(),
        location_lon: draft.locationLon.trim(),
        location_source: "manual",
        location_source_id: "",
        notes: draft.notes.trim() || null,
        created_at: null,
      });
      setDraft({
        name: "",
        contact: "",
        address: "",
        locationDisplayName: "",
        locationStreet: "",
        locationHouseNumber: "",
        locationPostcode: "",
        locationCity: "",
        locationState: "",
        locationCountry: "",
        locationLat: "",
        locationLon: "",
        notes: "",
      });
      await reloadSuppliers();
    } catch (err) {
      setSupplierError(err instanceof Error ? err.message : "Lieferant konnte nicht angelegt werden.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Lieferanten</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input className={formInputClass} placeholder="Name *" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
            <input className={formInputClass} placeholder="Kontakt" value={draft.contact} onChange={(e) => setDraft((prev) => ({ ...prev, contact: e.target.value }))} />
            <input className={formInputClass} placeholder="Standortname" value={draft.locationDisplayName} onChange={(e) => setDraft((prev) => ({ ...prev, locationDisplayName: e.target.value }))} />
            <input className={formInputClass} placeholder="Straße" value={draft.locationStreet} onChange={(e) => setDraft((prev) => ({ ...prev, locationStreet: e.target.value }))} />
            <input className={formInputClass} placeholder="Hausnummer" value={draft.locationHouseNumber} onChange={(e) => setDraft((prev) => ({ ...prev, locationHouseNumber: e.target.value }))} />
            <input className={formInputClass} placeholder="PLZ" value={draft.locationPostcode} onChange={(e) => setDraft((prev) => ({ ...prev, locationPostcode: e.target.value }))} />
            <input className={formInputClass} placeholder="Stadt *" value={draft.locationCity} onChange={(e) => setDraft((prev) => ({ ...prev, locationCity: e.target.value }))} />
            <input className={formInputClass} placeholder="Bundesland/Region" value={draft.locationState} onChange={(e) => setDraft((prev) => ({ ...prev, locationState: e.target.value }))} />
            <input className={formInputClass} placeholder="Land *" value={draft.locationCountry} onChange={(e) => setDraft((prev) => ({ ...prev, locationCountry: e.target.value }))} />
            <input className={formInputClass} placeholder="Breitengrad" value={draft.locationLat} onChange={(e) => setDraft((prev) => ({ ...prev, locationLat: e.target.value }))} />
            <input className={formInputClass} placeholder="Längengrad" value={draft.locationLon} onChange={(e) => setDraft((prev) => ({ ...prev, locationLon: e.target.value }))} />
            <input className={formInputClass} placeholder="Adressanzeige (optional)" value={draft.address} onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))} />
            <input className={formInputClass} placeholder="Notizen" value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={createSupplier} disabled={creating || draft.name.trim() === "" || draft.locationCity.trim() === "" || draft.locationCountry.trim() === ""}>
              {creating ? "Speichere..." : "Lieferant anlegen"}
            </Button>
            {supplierError ? <span className="text-sm text-red-400">{supplierError}</span> : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((supplier) => (
              <Card key={supplier.id} className={dark ? "border-gray-800" : "border-gray-200"}>
                <CardContent className="p-4">
                  <h3 className="text-base font-semibold">{supplier.name}</h3>
                  <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>{supplier.contact || "Kein Kontakt hinterlegt"}</p>
                  <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>{supplier.location_display_name || supplier.address || "Kein Standort hinterlegt"}</p>
                  <p className={`text-xs ${dark ? "text-gray-500" : "text-gray-500"}`}>
                    {supplier.location_postcode || supplier.location_city || supplier.location_country
                      ? [supplier.location_postcode, supplier.location_city, supplier.location_country].filter(Boolean).join(" · ")
                      : "Keine Ortsdaten hinterlegt"}
                  </p>
                  {supplier.notes ? <p className="mt-2 text-xs italic">{supplier.notes}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
