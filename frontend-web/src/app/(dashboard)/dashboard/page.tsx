'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi, apiariesApi, weatherApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonStatCard, SkeletonCard, SkeletonList } from '@/components/ui/skeleton';
import { MapPin, Box, ClipboardCheck, Droplet, Sun, Cloud, CloudRain, Wind, Thermometer, CloudSnow } from 'lucide-react';
import Link from 'next/link';

function getWeatherIcon(conditionCode: string) {
  if (conditionCode.includes('snow') || conditionCode.includes('sleet')) return CloudSnow;
  if (conditionCode.includes('rain')) return CloudRain;
  if (conditionCode.includes('cloud') || conditionCode.includes('fog')) return Cloud;
  return Sun;
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'I dag';
  if (date.toDateString() === tomorrow.toDateString()) return 'I morgen';
  return date.toLocaleDateString('nb-NO', { weekday: 'short' });
}

function OverviewLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
    >
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsApi.overview(),
  });

  const { data: apiariesResponse, isLoading: apiariesLoading } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const stats = statsResponse?.data;
  const apiaries = apiariesResponse?.data || [];

  const weatherApiary = useMemo(() => {
    return apiaries.find((a) => a.location?.lat && a.location?.lng);
  }, [apiaries]);

  const { data: currentWeatherRes, isLoading: weatherLoading } = useQuery({
    queryKey: ['weather', 'current', weatherApiary?.location?.lat, weatherApiary?.location?.lng],
    queryFn: () => weatherApi.current(weatherApiary!.location!.lat!, weatherApiary!.location!.lng!),
    enabled: !!weatherApiary,
    staleTime: 10 * 60 * 1000,
  });

  const { data: forecastRes } = useQuery({
    queryKey: ['weather', 'forecast', weatherApiary?.location?.lat, weatherApiary?.location?.lng],
    queryFn: () => weatherApi.forecast(weatherApiary!.location!.lat!, weatherApiary!.location!.lng!),
    enabled: !!weatherApiary,
    staleTime: 10 * 60 * 1000,
  });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Oversikt over din birøkt</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Oversikt over din birøkt</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-honey-100 rounded-lg">
                <MapPin className="w-6 h-6 text-honey-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Bigårder</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.apiaries.total || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Box className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Aktive kuber</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.hives.active || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ClipboardCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Inspeksjoner i år</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.inspections.total || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Droplet className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Honning i år</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.production.honeyKg || 0} kg
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Kubestatus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <OverviewLink href="/hives?strength=strong">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Sterke</span>
                </div>
                <span className="font-semibold">{stats?.hives.byStrength.strong || 0}</span>
              </OverviewLink>
              <OverviewLink href="/hives?strength=medium">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Medium</span>
                </div>
                <span className="font-semibold">{stats?.hives.byStrength.medium || 0}</span>
              </OverviewLink>
              <OverviewLink href="/hives?strength=weak">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Svake</span>
                </div>
                <span className="font-semibold">{stats?.hives.byStrength.weak || 0}</span>
              </OverviewLink>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Helsestatus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <OverviewLink href="/hives?healthStatus=healthy">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Frisk</Badge>
                </div>
                <span className="font-semibold">{stats?.hives.byHealth.healthy || 0}</span>
              </OverviewLink>
              <OverviewLink href="/hives?healthStatus=warning">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Advarsel</Badge>
                </div>
                <span className="font-semibold">{stats?.hives.byHealth.warning || 0}</span>
              </OverviewLink>
              <OverviewLink href="/hives?healthStatus=critical">
                <div className="flex items-center gap-2">
                  <Badge variant="danger">Kritisk</Badge>
                </div>
                <span className="font-semibold">{stats?.hives.byHealth.critical || 0}</span>
              </OverviewLink>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Apiaries list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dine bigårder</CardTitle>
          <Link
            href="/apiaries"
            className="text-sm text-honey-600 hover:text-honey-700"
          >
            Se alle
          </Link>
        </CardHeader>
        <CardContent>
          {apiariesLoading ? (
            <SkeletonList rows={3} />
          ) : apiaries.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">Du har ingen bigårder ennå</p>
              <Link
                href="/apiaries"
                className="text-honey-600 hover:text-honey-700 font-medium"
              >
                Opprett din første bigård
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {apiaries.slice(0, 5).map((apiary) => (
                <Link
                  key={apiary.id}
                  href={`/apiaries/${apiary.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 rounded-lg transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{apiary.name}</p>
                    <p className="text-sm text-gray-500">{apiary.location?.name || 'Ingen lokasjon'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{apiary.hiveCount} kuber</p>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-green-600">{apiary.stats.healthy} ok</span>
                        {apiary.stats.warning > 0 && (
                          <span className="text-yellow-600">• {apiary.stats.warning} adv.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Weather card */}
      {weatherApiary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-honey-500" />
              Vær — {weatherApiary.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weatherLoading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <div className="flex gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 flex-1 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : currentWeatherRes?.data ? (
              <div className="space-y-4">
                {/* Current weather */}
                <div className="flex items-center gap-4">
                  {(() => {
                    const Icon = getWeatherIcon(currentWeatherRes.data.conditionCode);
                    return (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <Icon className="w-8 h-8 text-blue-500" />
                      </div>
                    );
                  })()}
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {currentWeatherRes.data.temperature.toFixed(1)}°C
                    </p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Wind className="w-3.5 h-3.5" />
                        {currentWeatherRes.data.windSpeed.toFixed(1)} m/s
                      </span>
                      <span className="capitalize">{currentWeatherRes.data.condition}</span>
                    </div>
                  </div>
                </div>

                {/* 5-day forecast */}
                {forecastRes?.data?.forecast && forecastRes.data.forecast.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">5-dagers prognose</p>
                    <div className="grid grid-cols-5 gap-2">
                      {forecastRes.data.forecast.slice(0, 5).map((day) => {
                        const Icon = getWeatherIcon(day.conditionCode);
                        return (
                          <div
                            key={day.date}
                            className="flex flex-col items-center gap-1 p-2 bg-gray-50 rounded-lg"
                          >
                            <span className="text-xs font-medium text-gray-600 capitalize">
                              {getDayName(day.date)}
                            </span>
                            <Icon className="w-5 h-5 text-gray-500" />
                            <span className="text-sm font-semibold text-gray-900">
                              {Math.round(day.temperature)}°
                            </span>
                            <span className="text-xs text-gray-400">
                              {day.windSpeed.toFixed(0)} m/s
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400">
                  Data fra YR.no (met.no)
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
