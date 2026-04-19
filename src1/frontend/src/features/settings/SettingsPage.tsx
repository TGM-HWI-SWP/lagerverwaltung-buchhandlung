import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppSettings } from "@/types";

interface SettingsPageProps {
  card: string;
  dark: boolean;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onSeedDemoData: () => Promise<void>;
  onClearDemoData: () => Promise<void>;
  demoDataBusy: boolean;
  demoDataStatus: string | null;
}

export function SettingsPage({
  card,
  dark,
  settings,
  setSettings,
  onSeedDemoData,
  onClearDemoData,
  demoDataBusy,
  demoDataStatus,
}: SettingsPageProps) {
  const defaultSettings: AppSettings = {
    lowStockThreshold: 5,
    confirmDelete: true,
    autoRefresh: false,
    autoRefreshSeconds: 30,
    loadDemoData: true,
  };

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Einstellungen</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <h3 className="font-medium">Lageranzeige: Niedriger Bestand</h3>
                <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>
                  Schwellenwert für Highlighting von Büchern mit niedrigem Bestand.
                </p>
              </div>
              <input
                type="number"
                min={1}
                className={`w-24 rounded-lg border px-3 py-2 ${dark ? "border-gray-700 bg-gray-900 text-white" : "border-gray-300 bg-white"}`}
                value={settings.lowStockThreshold}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    lowStockThreshold: Math.max(1, Number(e.target.value) || 5),
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <h3 className="font-medium">Löschbestätigung</h3>
                <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>
                  Nachfrage vor dem Löschen von Büchern anzeigen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, confirmDelete: !prev.confirmDelete }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.confirmDelete ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.confirmDelete ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <h3 className="font-medium">Auto-Aktualisierung</h3>
                <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>
                  Daten alle X Sekunden automatisch neu laden.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoRefresh ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoRefresh ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                {settings.autoRefresh && (
                  <input
                    type="number"
                    min={10}
                    className={`w-24 rounded-lg border px-3 py-2 ${dark ? "border-gray-700 bg-gray-900 text-white" : "border-gray-300 bg-white"}`}
                    value={settings.autoRefreshSeconds}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        autoRefreshSeconds: Math.max(10, Number(e.target.value) || 30),
                      }))
                    }
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <h3 className="font-medium">Demo-Daten laden</h3>
                <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>
                  Bei leerer Datenbank automatisch Demo-Daten laden (Bücher, Verkäufe, Mitarbeiter).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, loadDemoData: !prev.loadDemoData }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.loadDemoData ? "bg-green-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.loadDemoData ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setSettings({ ...settings, ...defaultSettings })}>
                  Standard wiederherstellen
                </Button>
                <Button variant="outline" onClick={onSeedDemoData} disabled={demoDataBusy}>
                  {demoDataBusy ? "Lade Demo-Daten..." : "Demo-Daten laden"}
                </Button>
                <Button variant="destructive" onClick={onClearDemoData} disabled={demoDataBusy}>
                  Demo-Daten löschen
                </Button>
              </div>
              {demoDataStatus ? (
                <p className={`mt-3 text-sm ${dark ? "text-gray-300" : "text-gray-700"}`}>{demoDataStatus}</p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
