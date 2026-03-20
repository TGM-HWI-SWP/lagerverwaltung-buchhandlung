import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Sun,
  Moon,
  Package,
  BarChart3,
  FileText,
  Settings as SettingsIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/api/client";

type PageKey = "dashboard" | "lager" | "reports" | "einstellungen";

type Book = {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher?: string | null;
  price: number;
};

export default function Dashboard() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState<PageKey>("dashboard");
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  const toggleTheme = () => setDark((prev) => !prev);

  useEffect(() => {
    setLoadingBooks(true);
    setBookError(null);
    apiGet<Book[]>("/books")
      .then((data) => setBooks(data))
      .catch((err: Error) => setBookError(err.message))
      .finally(() => setLoadingBooks(false));
  }, []);

  const stats = useMemo(() => {
    const totalBooks = books.length;
    const authors = new Set(books.map((b) => b.author)).size;
    const totalValue = books.reduce((sum, b) => sum + b.price, 0);
    return { totalBooks, authors, totalValue };
  }, [books]);

  const container = dark
    ? "min-h-screen bg-gray-950 text-white"
    : "min-h-screen bg-gray-100 text-gray-900";

  const sidebar = dark
    ? "w-64 bg-gray-900 text-white"
    : "w-64 bg-white text-gray-900 border-r";

  const topbar = dark
    ? "flex justify-between items-center p-6 border-b border-gray-800"
    : "flex justify-between items-center p-6 border-b border-gray-200";

  const card = dark
    ? "bg-gray-900 border-gray-800 text-white"
    : "bg-white border-gray-200 text-gray-900";

  return (
    <div className={container}>
      <div className="flex">
        {/* Sidebar */}
        <div className={sidebar}>
          <div className="p-6 text-xl font-bold">BookManager</div>

          <nav className="flex flex-col gap-2 px-3">
            <MenuButton
              icon={<BarChart3 size={18} />}
              label="Dashboard"
              value="dashboard"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<Package size={18} />}
              label="Lager"
              value="lager"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<FileText size={18} />}
              label="Reports"
              value="reports"
              page={page}
              setPage={setPage}
              dark={dark}
            />
            <MenuButton
              icon={<SettingsIcon size={18} />}
              label="Einstellungen"
              value="einstellungen"
              page={page}
              setPage={setPage}
              dark={dark}
            />
          </nav>
        </div>

        {/* Main Area */}
        <div className="flex-1">
          {/* Topbar */}
          <div className={topbar}>
            <h1 className="text-2xl font-semibold capitalize">{page}</h1>

            <Button variant="outline" onClick={toggleTheme}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>

          <div className="p-6">
            {page === "dashboard" && (
              <DashboardPage card={card} stats={stats} loading={loadingBooks} />
            )}
            {page === "lager" && (
              <InventoryPage
                card={card}
                books={books}
                loading={loadingBooks}
                error={bookError}
                dark={dark}
              />
            )}
            {page === "reports" && <ReportsPage card={card} />}
            {page === "einstellungen" && <SettingsPage card={card} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({
  card,
  stats,
  loading,
}: {
  card: string;
  stats: { totalBooks: number; authors: number; totalValue: number };
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Bücher im Lager</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.totalBooks}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Autoren</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.authors}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Gesamtwert Lager</h2>
          <p className="mt-2 text-3xl">
            {loading ? "…" : `€${stats.totalValue.toFixed(2)}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryPage({
  card,
  books,
  loading,
  error,
  dark,
}: {
  card: string;
  books: Book[];
  loading: boolean;
  error: string | null;
  dark: boolean;
}) {
  const inputClass = dark
    ? "w-80 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-400"
    : "w-80 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500";

  const mutedText = dark ? "text-gray-400" : "text-gray-500";
  const tableBorder = dark ? "border-gray-800" : "border-gray-200";
  const tableHeadText = dark ? "text-gray-400" : "text-gray-500";

  return (
    <div className="space-y-6">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Bücherverwaltung</h2>

          <div className="mb-4 flex flex-wrap gap-3">
            <input
              placeholder="Suche nach Titel oder Autor..."
              className={inputClass}
            />
            <Button>Suche</Button>
            <Button>Neues Buch</Button>
          </div>

          {loading && <p className={`text-sm ${mutedText}`}>Lade Bücher…</p>}
          {error && (
            <p className="text-sm text-red-400">
              Fehler beim Laden der Bücher: {error}
            </p>
          )}

          {!loading && !error && (
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className={`border-b ${tableBorder} text-xs uppercase ${tableHeadText}`}>
                  <th className="py-2">Titel</th>
                  <th>Autor</th>
                  <th>Preis</th>
                  <th>Aktionen</th>
                </tr>
              </thead>

              <tbody>
                {books.length === 0 && (
                  <tr>
                    <td className={`py-4 ${mutedText}`} colSpan={4}>
                      Keine Bücher vorhanden.
                    </td>
                  </tr>
                )}
                {books.map((book) => (
                  <tr
                    key={book.id}
                    className={`border-b ${tableBorder} last:border-b-0`}
                  >
                    <td className="py-2">{book.title}</td>
                    <td>{book.author}</td>
                    <td>{book.price.toFixed(2)} €</td>
                    <td className="flex gap-2 py-2">
                      <Button size="sm">Bearbeiten</Button>
                      <Button size="sm" variant="destructive">
                        Löschen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsPage({ card }: { card: string }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Report A</h2>
          <p>Lagerbestandsbericht anzeigen oder exportieren.</p>
          <Button className="mt-4">Report generieren</Button>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Report B</h2>
          <p>Bestandsentwicklung als Grafik anzeigen.</p>
          <Button className="mt-4">Grafik anzeigen</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPage({ card }: { card: string }) {
  return (
    <Card className={card}>
      <CardContent className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Systemeinstellungen</h2>
        <p>
          Hier können zukünftige Einstellungen für Datenbank oder Reports
          ergänzt werden.
        </p>
      </CardContent>
    </Card>
  );
}

function MenuButton({
  icon,
  label,
  value,
  page,
  setPage,
  dark,
}: {
  icon: ReactNode;
  label: string;
  value: PageKey;
  page: PageKey;
  setPage: (page: PageKey) => void;
  dark: boolean;
}) {
  const base =
    "flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm";
  const active = dark
    ? "bg-gray-800 text-white"
    : "bg-gray-200 text-gray-900";
  const inactive = dark
    ? "text-gray-300 hover:bg-gray-800"
    : "text-gray-700 hover:bg-gray-100";

  const classes = `${base} ${page === value ? active : inactive}`;

  return (
    <button onClick={() => setPage(value)} className={classes}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

