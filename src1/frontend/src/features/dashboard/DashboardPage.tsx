import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import type { SaleOrder } from "@/types";

interface DashboardPageProps {
  card: string;
  stats: {
    totalProducts: number;
    categories: number;
    totalUnits: number;
    totalValue: number;
    totalRevenue: number;
  };
  loading: boolean;
  salesOrders: SaleOrder[];
}

export function DashboardPage({ card, stats, loading, salesOrders }: DashboardPageProps) {
  const revenueData = useMemo(() => {
    const monthlyRevenue: Record<string, number> = {};
    salesOrders.forEach((entry) => {
      const date = new Date(entry.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + entry.total;
    });
    return Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [salesOrders]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Katalogprodukte</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.totalProducts}</p>
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
          <h2 className="text-lg font-semibold">Bestand gesamt</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : stats.totalUnits}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Lagerwert</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : `€${stats.totalValue.toFixed(2)}`}</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Verkaufsumsatz</h2>
          <p className="mt-2 text-3xl">{loading ? "…" : `€${stats.totalRevenue.toFixed(2)}`}</p>
        </CardContent>
      </Card>

      <Card className={`${card} md:col-span-5`}>
        <CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Umsatzentwicklung</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`€${Number(value).toFixed(2)}`, "Umsatz"]} />
              <Bar dataKey="revenue" fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
