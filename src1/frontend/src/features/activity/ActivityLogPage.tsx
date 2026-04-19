import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivityLog } from "@/types";
import { apiGet } from "@/api/client";

interface ActivityLogPageProps {
  card: string;
  dark: boolean;
}

export function ActivityLogPage({ card, dark }: ActivityLogPageProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutedText = dark ? "text-gray-400" : "text-gray-500";

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ total: number; offset: number; limit: number; logs: ActivityLog[] }>("/activity-logs", {
        offset,
        limit,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [offset]);

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold">Aktivitäts-Log</h2>
          <p className={`mt-2 text-sm ${mutedText}`}>
            Übersicht über alle Aktionen im System (Erstellt, Aktualisiert, Gelöscht, Bestellungen, Lieferungen).
          </p>

          {loading && <p className={`mt-4 text-sm ${mutedText}`}>Lade Logs...</p>}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          {!loading && !error && (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className={`border-b ${dark ? "border-gray-800" : "border-gray-200"} text-xs uppercase ${mutedText}`}>
                      <th className="py-2">Zeit</th>
                      <th>Benutzer</th>
                      <th>Aktion</th>
                      <th>Entität</th>
                      <th>ID</th>
                      <th>Änderungen</th>
                      <th>Grund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td className={`py-4 ${mutedText}`} colSpan={7}>
                          Keine Aktivitäts-Logs vorhanden.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className={`border-b ${dark ? "border-gray-800" : "border-gray-200"} last:border-b-0`}>
                          <td className="py-2">{new Date(log.timestamp).toLocaleString("de-DE")}</td>
                          <td>{log.performed_by}</td>
                          <td>{log.action}</td>
                          <td>{log.entity_type}</td>
                          <td className="font-mono text-xs">{log.entity_id}</td>
                          <td className="max-w-xs truncate" title={log.changes || undefined}>
                            {log.changes ? (
                              <details>
                                <summary className="cursor-pointer text-blue-500">Details</summary>
                                <pre className="mt-1 overflow-auto text-xs">
                                  {log.changes}
                                </pre>
                              </details>
                            ) : "-"}
                          </td>
                          <td>{log.reason || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className={`text-sm ${mutedText}`}>
                  Zeige {offset + 1}–{Math.min(offset + limit, total)} von {total}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
                    Zurück
                  </Button>
                  <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset((o) => o + limit)}>
                    Mehr laden
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
