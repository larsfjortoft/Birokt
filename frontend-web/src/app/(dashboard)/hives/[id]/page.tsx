'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { hivesApi, photosApi, queensApi, getImageUrl } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { InspectionForm } from '@/components/forms/inspection-form';
import { ArrowLeft, MapPin, Calendar, Crown, Layers, Plus, Camera, Star } from 'lucide-react';
import Link from 'next/link';
import { formatDate, getStrengthColor, getHealthColor, getQueenColorHex } from '@/lib/utils';

export default function HiveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const hiveId = params.id as string;
  const [showInspectionModal, setShowInspectionModal] = useState(false);

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['hive', hiveId],
    queryFn: () => hivesApi.get(hiveId),
  });

  const { data: photosResponse } = useQuery({
    queryKey: ['photos', hiveId],
    queryFn: () => photosApi.list({ hiveId, perPage: '12' }),
    enabled: !!hiveId,
  });

  const { data: queensResponse } = useQuery({
    queryKey: ['queens', 'hive', hiveId],
    queryFn: () => queensApi.list({ hiveId }),
    enabled: !!hiveId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-honey-500"></div>
      </div>
    );
  }

  if (error || !response?.data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Kunne ikke laste kube</p>
        <Button variant="outline" onClick={() => router.push('/hives')}>
          Tilbake til kuber
        </Button>
      </div>
    );
  }

  const hive = response.data as {
    id: string;
    hiveNumber: string;
    qrCode?: string;
    apiary: { id: string; name: string; location?: { name?: string; lat?: number; lng?: number } };
    status: string;
    strength?: string;
    hiveType: string;
    boxCount: number;
    queen: { year?: number; marked: boolean; color?: string; race?: string };
    currentFrames: { brood: number; honey: number };
    inspections: Array<{ id: string; inspectionDate: string; strength?: string; healthStatus: string; notes?: string }>;
    treatments: Array<{ id: string; date: string; product: string; withholdingEnd?: string }>;
    stats: { totalInspections: number; totalTreatments: number; totalFeedings: number };
    notes?: string;
    createdAt: string;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/hives')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-honey-100 rounded-xl flex items-center justify-center">
              <span className="text-honey-700 font-bold text-xl">{hive.hiveNumber}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kube {hive.hiveNumber}</h1>
              <Link
                href={`/apiaries/${hive.apiary.id}`}
                className="text-gray-500 hover:text-honey-600 flex items-center gap-1"
              >
                <MapPin className="w-4 h-4" />
                {hive.apiary.name}
              </Link>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowInspectionModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny inspeksjon
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Status</p>
            <Badge
              variant={hive.status === 'active' ? 'success' : hive.status === 'dead' ? 'danger' : 'default'}
              className="mt-1"
            >
              {hive.status === 'active' ? 'Aktiv' : hive.status === 'nuc' ? 'Avlegger' : hive.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Styrke</p>
            {hive.strength ? (
              <span className={`inline-block px-2 py-1 mt-1 rounded text-xs font-medium ${getStrengthColor(hive.strength)}`}>
                {hive.strength === 'strong' ? 'Sterk' : hive.strength === 'medium' ? 'Medium' : 'Svak'}
              </span>
            ) : (
              <p className="text-gray-400 text-sm mt-1">Ikke vurdert</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Kasser</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{hive.boxCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Inspeksjoner</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{hive.stats.totalInspections}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queen info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-honey-500" />
              {(() => {
                const qd = queensResponse?.data as Array<{ id: string }> | undefined;
                const count = qd?.length || 0;
                return count > 1 ? `Dronninger (${count})` : 'Dronning';
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const queenData = queensResponse?.data as Array<{
                id: string;
                queenCode: string;
                year: number;
                race?: string;
                color?: string;
                marked: boolean;
                status: string;
                rating?: number;
              }> | undefined;

              const statusLabels: Record<string, string> = {
                virgin: 'Jomfru', mated: 'Paret', laying: 'Leggende',
                failed: 'Feilet', dead: 'Dod', sold: 'Solgt', missing: 'Savnet',
              };

              if (queenData && queenData.length > 0) {
                return (
                  <div className="space-y-3">
                    {queenData.map((q, idx) => (
                      <Link
                        key={q.id}
                        href={`/queens/${q.id}`}
                        className={`block hover:bg-gray-50 p-3 rounded-lg transition-colors ${idx > 0 ? 'border-t border-gray-100' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Crown className="w-5 h-5 text-honey-500" />
                            {q.color && (
                              <div
                                className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
                                style={{ backgroundColor: getQueenColorHex(q.color) }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-honey-600">{q.queenCode}</span>
                              <Badge variant={q.status === 'laying' ? 'success' : 'default'}>
                                {statusLabels[q.status] || q.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{q.year}</span>
                              {q.race && <span>{q.race}</span>}
                              {q.rating && (
                                <span className="flex items-center gap-0.5 text-amber-500">
                                  <Star className="w-3 h-3 fill-current" />
                                  {q.rating}/5
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                );
              }

              // Fallback to flat queen fields
              if (hive.queen?.year) {
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Ar</span>
                      <span className="font-medium">{hive.queen.year}</span>
                    </div>
                    {hive.queen.race && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Rase</span>
                        <span className="font-medium">{hive.queen.race}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Merket</span>
                      <span className="font-medium">{hive.queen.marked ? 'Ja' : 'Nei'}</span>
                    </div>
                    {hive.queen.color && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Farge</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: getQueenColorHex(hive.queen.color) }}
                          />
                          <span className="font-medium capitalize">{hive.queen.color}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return <p className="text-gray-500 text-center py-4">Ingen dronninginfo registrert</p>;
            })()}
          </CardContent>
        </Card>

        {/* Frame counts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-honey-500" />
              Rammer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Yngelrammer</span>
                <span className="font-medium">{hive.currentFrames.brood}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Honningrammer</span>
                <span className="font-medium">{hive.currentFrames.honey}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent inspections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-honey-500" />
            Siste inspeksjoner
          </CardTitle>
          {hive.inspections.length > 0 && (
            <Link
              href={`/inspections?hiveId=${hiveId}`}
              className="text-sm text-honey-600 hover:text-honey-700 font-medium"
            >
              Se alle
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {hive.inspections.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Ingen inspeksjoner registrert</p>
          ) : (
            <div className="space-y-4">
              {hive.inspections.map((inspection) => (
                <Link
                  key={inspection.id}
                  href={`/inspections/${inspection.id}`}
                  className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold text-gray-900">
                      {new Date(inspection.inspectionDate).getDate()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(inspection.inspectionDate).toLocaleDateString('nb-NO', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {inspection.strength && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStrengthColor(inspection.strength)}`}>
                          {inspection.strength === 'strong' ? 'Sterk' : inspection.strength === 'medium' ? 'Medium' : 'Svak'}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getHealthColor(inspection.healthStatus)}`}>
                        {inspection.healthStatus === 'healthy' ? 'Frisk' : inspection.healthStatus === 'warning' ? 'Advarsel' : 'Kritisk'}
                      </span>
                    </div>
                    {inspection.notes && (
                      <p className="text-sm text-gray-600">{inspection.notes}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active treatments */}
      {hive.treatments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Behandlinger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hive.treatments.map((treatment) => (
                <div key={treatment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{treatment.product}</p>
                    <p className="text-sm text-gray-500">{formatDate(treatment.date)}</p>
                  </div>
                  {treatment.withholdingEnd && new Date(treatment.withholdingEnd) >= new Date() && (
                    <Badge variant="warning">
                      Karantene til {formatDate(treatment.withholdingEnd)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {photosResponse?.data && photosResponse.data.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-honey-500" />
              Bilder ({photosResponse.data.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {photosResponse.data.map((photo) => (
                <a
                  key={photo.id}
                  href={getImageUrl(photo.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-honey-400 transition-colors"
                >
                  <img
                    src={getImageUrl(photo.thumbnailUrl || photo.url)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {hive.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notater</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{hive.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Inspection Modal */}
      <Modal
        isOpen={showInspectionModal}
        onClose={() => setShowInspectionModal(false)}
        title={`Ny inspeksjon - Kube ${hive.hiveNumber}`}
        size="lg"
      >
        <InspectionForm
          hiveId={hiveId}
          hiveNumber={hive.hiveNumber}
          apiaryLocation={hive.apiary.location}
          onSuccess={() => setShowInspectionModal(false)}
          onCancel={() => setShowInspectionModal(false)}
        />
      </Modal>
    </div>
  );
}
