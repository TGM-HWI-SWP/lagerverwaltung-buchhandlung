import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ReportsPageProps {
  card: string;
  dark: boolean;
  onOpenDashboard: () => void;
}

export function ReportsPage({ card, dark, onOpenDashboard }: ReportsPageProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const mutedText = dark ? "text-gray-400" : "text-gray-500";

  const downloadInventoryPdf = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const apiBase =
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";
      const response = await fetch(`${apiBase}/reports/inventory-pdf`);
      if (!response.ok) {
        throw new Error(`API-Fehler: ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "lagerbestand.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className={`${card} xl:col-span-2`}>
        <CardContent className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Lagerbestandsbericht</h2>
          <p className={`max-w-2xl text-sm ${mutedText}`}>
            Erzeugt einen PDF-Bericht mit der aktuellen Verteilung des Lagerbestands nach Kategorien.
          </p>
          <Button className="mt-4" onClick={downloadInventoryPdf} disabled={downloading}>
            {downloading ? "PDF wird erstellt…" : "PDF exportieren"}
          </Button>
          {downloadError && (
            <p className="mt-2 text-sm text-red-400">Fehler: {downloadError}</p>
          )}
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Bestandsentwicklung</h2>
          <p className={`text-sm ${mutedText}`}>
            Die wichtigsten Verläufe siehst du bereits im Dashboard. Weitere Berichte können hier ergänzt werden.
          </p>
          <Button className="mt-4" variant="outline" onClick={onOpenDashboard}>Zum Dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
}
