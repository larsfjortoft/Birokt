'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { inspectionsApi, apiariesApi, getImageUrl } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ClipboardCheck, Search, ChevronLeft, ChevronRight, Thermometer, Wind, Camera } from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, getStrengthColor, getHealthColor } from '@/lib/utils';

const strengthLabels: Record<string, string> = {
  strong: 'Sterk',
  medium: 'Medium',
  weak: 'Svak',
};

const healthLabels: Record<string, string> = {
  healthy: 'Frisk',
  warning: 'Advarsel',
  critical: 'Kritisk',
};

const actionLabels: Record<string, string> = {
  swarm_tendency: 'Svermetrang',
  hunger: 'Sult',
  space_shortage: 'Plassmangel',
};

interface Inspection {
  id: string;
  hive: { id: string; hiveNumber: string; apiaryName: string };
  user: { id: string; name: string };
  inspectionDate: string;
  weather: { temperature?: number; windSpeed?: number; condition?: string };
  assessment: { strength?: string; temperament?: string; queenSeen: boolean; queenLaying: boolean };
  frames: { brood: number; honey: number; pollen: number; empty: number };
  health: { status: string; varroaLevel?: string; diseases: string[]; pests: string[] };
  photos: Array<{ id: string; url: string; thumbnailUrl: string }>;
  actions: Array<{ id: string; actionType: string }>;
  notes?: string;
  createdAt: string;
}

export default function InspectionsPage() {
  const searchParams = useSearchParams();
  const preselectedHiveId = searchParams.get('hiveId') || '';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [apiaryId, setApiaryId] = useState('');
  const [healthStatus, setHealthStatus] = useState('');
  const [strength, setStrength] = useState('');
  const [page, setPage] = useState(1);
  const [hiveId] = useState(preselectedHiveId);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [apiaryId, healthStatus, strength]);

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), perPage: '20' };
    if (hiveId) p.hiveId = hiveId;
    if (apiaryId) p.apiaryId = apiaryId;
    if (healthStatus) p.healthStatus = healthStatus;
    if (strength) p.strength = strength;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [page, hiveId, apiaryId, healthStatus, strength, debouncedSearch]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['inspections', params],
    queryFn: () => inspectionsApi.list(params),
  });

  const { data: apiariesResponse } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const inspections = (response?.data || []) as Inspection[];
  const pagination = response?.meta?.pagination;
  const apiaries = apiariesResponse?.data || [];

  // Group inspections by month
  const grouped = useMemo(() => {
    const groups: Record<string, Inspection[]> = {};
    for (const insp of inspections) {
      const d = new Date(insp.inspectionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(insp);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [inspections]);

  const formatMonthHeader = (key: string) => {
    const [year, month] = key.split('-');
    const d = new Date(Number(year), Number(month) - 1);
    return d.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inspeksjoner</h1>
        <p className="text-gray-500">Inspeksjonshistorikk med søk og filtrering</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Søk i notater..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
              />
            </div>
            <select
              value={apiaryId}
              onChange={(e) => setApiaryId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Alle bigårder</option>
              {apiaries.map((apiary) => (
                <option key={apiary.id} value={apiary.id}>{apiary.name}</option>
              ))}
            </select>
            <select
              value={healthStatus}
              onChange={(e) => setHealthStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Alle helsestatus</option>
              <option value="healthy">Frisk</option>
              <option value="warning">Advarsel</option>
              <option value="critical">Kritisk</option>
            </select>
            <select
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Alle styrker</option>
              <option value="strong">Sterk</option>
              <option value="medium">Medium</option>
              <option value="weak">Svak</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : inspections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Ingen inspeksjoner funnet</h3>
            <p className="text-gray-500">Prøv å endre filtrene eller søk etter noe annet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map(([monthKey, monthInspections]) => (
            <div key={monthKey}>
              <h2 className="text-lg font-semibold text-gray-700 mb-4 capitalize">
                {formatMonthHeader(monthKey)}
              </h2>
              <div className="space-y-3">
                {monthInspections.map((inspection) => (
                  <Link key={inspection.id} href={`/inspections/${inspection.id}`}>
                    <Card className="hover:border-honey-300 hover:shadow-md transition-all cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-start gap-4">
                          {/* Date */}
                          <div className="text-center min-w-[60px]">
                            <p className="text-2xl font-bold text-gray-900">
                              {new Date(inspection.inspectionDate).getDate()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(inspection.inspectionDate).toLocaleDateString('nb-NO', { month: 'short' })}
                            </p>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">
                                Kube {inspection.hive.hiveNumber}
                              </span>
                              <span className="text-sm text-gray-500">
                                — {inspection.hive.apiaryName}
                              </span>
                            </div>

                            {/* Badges */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              {inspection.assessment.strength && (
                                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStrengthColor(inspection.assessment.strength))}>
                                  {strengthLabels[inspection.assessment.strength] || inspection.assessment.strength}
                                </span>
                              )}
                              <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getHealthColor(inspection.health.status))}>
                                {healthLabels[inspection.health.status] || inspection.health.status}
                              </span>
                              {inspection.assessment.queenSeen && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium text-purple-600 bg-purple-100">
                                  Dronning sett
                                </span>
                              )}
                              {inspection.photos.length > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium text-blue-600 bg-blue-100 flex items-center gap-1">
                                  <Camera className="w-3 h-3" />
                                  {inspection.photos.length}
                                </span>
                              )}
                              {inspection.actions?.map((action) => (
                                <span key={action.id} className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                  {actionLabels[action.actionType] || action.actionType}
                                </span>
                              ))}
                            </div>

                            {/* Notes (truncated) */}
                            {inspection.notes && (
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {inspection.notes}
                              </p>
                            )}

                            {/* Weather */}
                            {(inspection.weather.temperature != null || inspection.weather.windSpeed != null) && (
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                {inspection.weather.temperature != null && (
                                  <span className="flex items-center gap-1">
                                    <Thermometer className="w-3 h-3" />
                                    {inspection.weather.temperature}°C
                                  </span>
                                )}
                                {inspection.weather.windSpeed != null && (
                                  <span className="flex items-center gap-1">
                                    <Wind className="w-3 h-3" />
                                    {inspection.weather.windSpeed} m/s
                                  </span>
                                )}
                                {inspection.weather.condition && (
                                  <span>{inspection.weather.condition}</span>
                                )}
                              </div>
                            )}

                            {/* Photo thumbnails */}
                            {inspection.photos.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {inspection.photos.slice(0, 4).map((photo) => (
                                  <img
                                    key={photo.id}
                                    src={getImageUrl(photo.thumbnailUrl || photo.url)}
                                    alt=""
                                    className="w-12 h-12 object-cover rounded-md border border-gray-200"
                                  />
                                ))}
                                {inspection.photos.length > 4 && (
                                  <div className="w-12 h-12 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                                    +{inspection.photos.length - 4}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Viser {(pagination.page - 1) * pagination.perPage + 1}–{Math.min(pagination.page * pagination.perPage, pagination.total)} av {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrev}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Forrige
            </Button>
            <span className="text-sm text-gray-700">
              Side {pagination.page} av {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => setPage(page + 1)}
            >
              Neste
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
