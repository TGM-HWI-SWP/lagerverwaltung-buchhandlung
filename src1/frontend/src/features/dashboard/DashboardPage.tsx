import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { SaleEntry } from "@/types";

interface DashboardPageProps {
  card: string;
  stats: {
    totalBooks: number;
    categories: number;
    totalUnits: number;
    totalValue: number;
    totalRevenue: number;
  };
  loading: boolean;
  salesLog: SaleEntry[];
}

export function DashboardPage({ card, stats, loading, salesLog }: DashboardPageProps) {
  const revenueData = useMemo(() => {
    const monthlyRevenue: { [key: string]: number } = {};
    salesLog
      .filter((entry) => entry.type === "Verkauf")
      .forEach((entry) => {
        const date = new Date(entry.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + entry.total;
      });
    return Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [salesLog]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Bücher im Lager</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.totalBooks}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Kategorien</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.categories}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Bestand (Stück)</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.totalUnits}</p>
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
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Umsatz</h2>
          <p className="mt-2 text-3xl">€{stats.totalRevenue.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card className={`${card} md:col-span-5`}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Umsatzentwicklung</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`€${Number(value).toFixed(2)}`, 'Umsatz']} />
              <Bar dataKey="revenue" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
