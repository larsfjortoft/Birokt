'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function StatisticsPage() {
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: chartsResponse, isLoading } = useQuery({
    queryKey: ['stats', 'charts', selectedYear],
    queryFn: () => statsApi.charts({ year: String(selectedYear) }),
  });

  const { data: overviewResponse } = useQuery({
    queryKey: ['stats', 'overview', selectedYear],
    queryFn: () => statsApi.overview({ year: String(selectedYear) }),
  });

  const charts = chartsResponse?.data;
  const overview = overviewResponse?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-honey-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistikk</h1>
          <p className="text-gray-500">Grafer og trender for din birøkt</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
        >
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-gray-500">Honning totalt</p>
              <p className="text-2xl font-bold text-amber-600">{overview.production.honeyKg} kg</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-gray-500">Inspeksjoner</p>
              <p className="text-2xl font-bold text-blue-600">{overview.inspections.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-gray-500">Behandlinger</p>
              <p className="text-2xl font-bold text-purple-600">{overview.treatments.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-gray-500">Snitt per kube</p>
              <p className="text-2xl font-bold text-green-600">{overview.inspections.avgPerHive}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Production chart */}
      <Card>
        <CardHeader>
          <CardTitle>Honningproduksjon per måned</CardTitle>
        </CardHeader>
        <CardContent>
          {charts?.monthlyProduction ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.monthlyProduction}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis unit=" kg" />
                <Tooltip formatter={(value) => [`${value} kg`, 'Honning']} />
                <Bar dataKey="honeyKg" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Honning (kg)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">Ingen produksjonsdata</p>
          )}
        </CardContent>
      </Card>

      {/* Health trends chart */}
      <Card>
        <CardHeader>
          <CardTitle>Helsetrender</CardTitle>
        </CardHeader>
        <CardContent>
          {charts?.monthlyHealth ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={charts.monthlyHealth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="healthy"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#dcfce7"
                  name="Frisk"
                />
                <Area
                  type="monotone"
                  dataKey="warning"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#fef3c7"
                  name="Advarsel"
                />
                <Area
                  type="monotone"
                  dataKey="critical"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#fee2e2"
                  name="Kritisk"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">Ingen helsedata</p>
          )}
        </CardContent>
      </Card>

      {/* Treatment timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Behandlingstidslinje</CardTitle>
        </CardHeader>
        <CardContent>
          {charts?.treatmentTimeline && charts.treatmentTimeline.length > 0 ? (
            <div className="space-y-2">
              {charts.treatmentTimeline.map((t, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-gray-500 w-24">{t.date}</span>
                  <span className="text-sm font-medium text-gray-900">{t.product}</span>
                  {t.target && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      {t.target}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Ingen behandlinger registrert</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
