import { useEffect, useState } from "react";

import { apiGet } from "@/api/client";
import { mapLocationSuggestionApi } from "@/lib/mappers";
import type { LocationSuggestion, LocationSuggestionApi } from "@/types";

type Props = {
  dark: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: LocationSuggestion) => void;
};

export function LocationAutocomplete({ dark, label, value, onChange, onSelect }: Props) {
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const inputClass = dark
    ? "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";
  const panelClass = dark
    ? "rounded-xl border border-gray-800 bg-gray-950/95"
    : "rounded-xl border border-gray-200 bg-white";

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await apiGet<LocationSuggestionApi[]>("/locations/search", { q: query, limit: 5 });
        setResults(rows.map(mapLocationSuggestionApi));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  return (
    <div className="space-y-2">
      <input className={inputClass} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} />
      {loading ? <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>Suche echte Orte...</p> : null}
      {results.length > 0 ? (
        <div className={`${panelClass} max-h-56 overflow-y-auto`}>
          {results.map((result) => (
            <button
              key={`${result.source}-${result.sourceId}-${result.lat}-${result.lon}`}
              type="button"
              className={`block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 ${dark ? "border-gray-800 text-gray-100 hover:bg-gray-900" : "border-gray-100 text-gray-900 hover:bg-gray-50"}`}
              onClick={() => {
                onSelect(result);
                setResults([]);
              }}
            >
              <div className="font-medium">{result.displayName || [result.street, result.houseNumber].filter(Boolean).join(" ")}</div>
              <div className={`${dark ? "text-gray-400" : "text-gray-500"}`}>
                {[result.postcode, result.city, result.country].filter(Boolean).join(" · ")}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
