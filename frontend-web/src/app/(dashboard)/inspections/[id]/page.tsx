'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { inspectionsApi, getImageUrl } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Thermometer,
  Wind,
  Crown,
  Heart,
  Layers,
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
} from 'lucide-react';
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

const temperamentLabels: Record<string, string> = {
  calm: 'Rolig',
  nervous: 'Nervøs',
  aggressive: 'Aggressiv',
};

const varroaLabels: Record<string, string> = {
  none: 'Ingen',
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
};

const diseaseLabels: Record<string, string> = {
  nosema: 'Nosema',
  foulbrood: 'Lukket yngelråte',
  chalkbrood: 'Kalkyngel',
  sacbrood: 'Sekkyngel',
};

const pestLabels: Record<string, string> = {
  varroa: 'Varroa',
  wax_moth: 'Voksmøll',
  small_hive_beetle: 'Kubebille',
  mice: 'Mus',
};

const actionLabels: Record<string, string> = {
  swarm_tendency: 'Svermetrang',
  hunger: 'Sult',
  space_shortage: 'Plassmangel',
};

const conditionLabels: Record<string, string> = {
  sunny: 'Sol',
  partly_cloudy: 'Delvis skyet',
  cloudy: 'Overskyet',
  rainy: 'Regn',
  windy: 'Vind',
};

interface InspectionDetail {
  id: string;
  hive: { id: string; hiveNumber: string; apiaryName: string };
  user: { id: string; name: string };
  inspectionDate: string;
  weather: { temperature?: number; windSpeed?: number; condition?: string };
  assessment: { strength?: string; temperament?: string; queenSeen: boolean; queenLaying: boolean };
  frames: { brood: number; honey: number; pollen: number; empty: number };
  health: { status: string; varroaLevel?: string; diseases: string[]; pests: string[] };
  photos: Array<{ id: string; url: string; thumbnailUrl: string; caption?: string }>;
  actions: Array<{ id: string; actionType: string; details: Record<string, unknown> }>;
  notes?: string;
  createdAt: string;
}

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inspectionId = params.id as string;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['inspection', inspectionId],
    queryFn: () => inspectionsApi.get(inspectionId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error || !response?.data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Kunne ikke laste inspeksjon</p>
        <Button variant="outline" onClick={() => router.push('/inspections')}>
          Tilbake til inspeksjoner
        </Button>
      </div>
    );
  }

  const inspection = response.data as InspectionDetail;
  const photos = inspection.photos || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Inspeksjon — Kube {inspection.hive.hiveNumber}
          </h1>
          <p className="text-gray-500">
            {new Date(inspection.inspectionDate).toLocaleDateString('nb-NO', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {' — '}
            <Link href={`/hives/${inspection.hive.id}`} className="text-honey-600 hover:text-honey-700">
              {inspection.hive.apiaryName}
            </Link>
          </p>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {inspection.assessment.strength && (
          <span className={cn('px-3 py-1 rounded-lg text-sm font-medium', getStrengthColor(inspection.assessment.strength))}>
            {strengthLabels[inspection.assessment.strength] || inspection.assessment.strength}
          </span>
        )}
        <span className={cn('px-3 py-1 rounded-lg text-sm font-medium', getHealthColor(inspection.health.status))}>
          {healthLabels[inspection.health.status] || inspection.health.status}
        </span>
        {inspection.assessment.queenSeen && (
          <span className="px-3 py-1 rounded-lg text-sm font-medium text-purple-600 bg-purple-100">
            Dronning sett
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weather */}
        {(inspection.weather.temperature != null || inspection.weather.windSpeed != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-honey-500" />
                Vær
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inspection.weather.temperature != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Temperatur</span>
                    <span className="font-medium">{inspection.weather.temperature}°C</span>
                  </div>
                )}
                {inspection.weather.windSpeed != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Vindstyrke</span>
                    <span className="font-medium">{inspection.weather.windSpeed} m/s</span>
                  </div>
                )}
                {inspection.weather.condition && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Værforhold</span>
                    <span className="font-medium">{conditionLabels[inspection.weather.condition] || inspection.weather.condition}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assessment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-honey-500" />
              Vurdering
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inspection.assessment.temperament && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Temperament</span>
                  <span className="font-medium">{temperamentLabels[inspection.assessment.temperament] || inspection.assessment.temperament}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Dronning sett</span>
                <span className="font-medium">{inspection.assessment.queenSeen ? 'Ja' : 'Nei'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Dronning legger</span>
                <span className="font-medium">{inspection.assessment.queenLaying ? 'Ja' : 'Nei'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Frames */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-honey-500" />
              Rammer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-700">{inspection.frames.brood}</p>
                <p className="text-xs text-gray-500">Yngel</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700">{inspection.frames.honey}</p>
                <p className="text-xs text-gray-500">Honning</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-700">{inspection.frames.pollen}</p>
                <p className="text-xs text-gray-500">Pollen</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-700">{inspection.frames.empty}</p>
                <p className="text-xs text-gray-500">Tomme</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-honey-500" />
              Helse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inspection.health.varroaLevel && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Varroatrykk</span>
                  <span className="font-medium">{varroaLabels[inspection.health.varroaLevel] || inspection.health.varroaLevel}</span>
                </div>
              )}
              {inspection.health.diseases.length > 0 && (
                <div>
                  <span className="text-gray-500 text-sm flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                    Sykdommer
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {inspection.health.diseases.map((d) => (
                      <span key={d} className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                        {diseaseLabels[d] || d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {inspection.health.pests.length > 0 && (
                <div>
                  <span className="text-gray-500 text-sm flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                    Skadedyr
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {inspection.health.pests.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                        {pestLabels[p] || p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {inspection.health.diseases.length === 0 && inspection.health.pests.length === 0 && !inspection.health.varroaLevel && (
                <p className="text-sm text-gray-400">Ingen helseproblemer registrert</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {inspection.actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Handlinger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {inspection.actions.map((action) => (
                <span
                  key={action.id}
                  className="px-3 py-1 rounded-lg text-sm font-medium bg-orange-100 text-orange-700"
                >
                  {actionLabels[action.actionType] || action.actionType}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {inspection.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notater</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 whitespace-pre-wrap">{inspection.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-honey-500" />
              Bilder ({photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-honey-400 transition-colors"
                >
                  <img
                    src={getImageUrl(photo.thumbnailUrl || photo.url)}
                    alt={photo.caption || `Bilde ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate">{photo.caption}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-400 flex items-center gap-4">
        <span>Registrert av {inspection.user.name}</span>
        <span>Opprettet {formatDate(inspection.createdAt)}</span>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={() => setLightboxIndex(lightboxIndex - 1)}
              className="absolute left-4 p-2 text-white/80 hover:text-white z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {lightboxIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={() => setLightboxIndex(lightboxIndex + 1)}
              className="absolute right-4 p-2 text-white/80 hover:text-white z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center">
            <img
              src={getImageUrl(photos[lightboxIndex].url)}
              alt={photos[lightboxIndex].caption || `Bilde ${lightboxIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-3 text-center">
              {photos[lightboxIndex].caption && (
                <p className="text-white text-sm mb-1">{photos[lightboxIndex].caption}</p>
              )}
              <p className="text-white/60 text-xs">
                {lightboxIndex + 1} / {photos.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
