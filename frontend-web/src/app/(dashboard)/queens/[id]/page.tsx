'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queensApi, hivesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ArrowLeft, Crown, Edit, MoveRight, RefreshCw, Star, Trash2, Clock } from 'lucide-react';
import Link from 'next/link';
import { formatDate, getQueenColorHex } from '@/lib/utils';

const statusLabels: Record<string, string> = {
  virgin: 'Jomfru',
  mated: 'Paret',
  laying: 'Leggende',
  failed: 'Feilet',
  dead: 'Dod',
  sold: 'Solgt',
  missing: 'Savnet',
};

const statusVariants: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'secondary'> = {
  virgin: 'default',
  mated: 'warning',
  laying: 'success',
  failed: 'danger',
  dead: 'danger',
  sold: 'secondary',
  missing: 'warning',
};

const originLabels: Record<string, string> = {
  own_production: 'Egen produksjon',
  purchased: 'Kjopt',
  swarm: 'Sverm',
  gifted: 'Gave',
  other: 'Annet',
};

const raceLabels: Record<string, string> = {
  buckfast: 'Buckfast',
  carnica: 'Carnica',
  italian: 'Italiensk',
  nordic: 'Nordisk brunbie',
  caucasian: 'Kaukasisk',
};

const temperamentLabels: Record<string, string> = {
  calm: 'Rolig',
  nervous: 'Nervos',
  aggressive: 'Aggressiv',
};

const productivityLabels: Record<string, string> = {
  low: 'Lav',
  medium: 'Medium',
  high: 'Hoy',
};

const actionLabels: Record<string, string> = {
  introduced: 'Introdusert',
  removed: 'Fjernet',
  moved: 'Flyttet',
};

interface Hive {
  id: string;
  hiveNumber: string;
  apiary: { id: string; name: string };
}

export default function QueenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queenId = params.id as string;
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['queen', queenId],
    queryFn: () => queensApi.get(queenId),
  });

  const { data: hivesResponse } = useQuery({
    queryKey: ['hives'],
    queryFn: () => hivesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: () => queensApi.delete(queenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queens'] });
      router.push('/queens');
    },
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
        <p className="text-gray-500 mb-4">Kunne ikke laste dronning</p>
        <Button variant="outline" onClick={() => router.push('/queens')}>
          Tilbake til dronninger
        </Button>
      </div>
    );
  }

  const queen = response.data;
  const hives = (hivesResponse?.data || []) as Hive[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/queens')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-honey-100 rounded-xl flex items-center justify-center relative">
              <Crown className="w-7 h-7 text-honey-600" />
              {queen.color && (
                <div
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                  style={{ backgroundColor: getQueenColorHex(queen.color) }}
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{queen.queenCode}</h1>
                <Badge variant={statusVariants[queen.status] || 'default'}>
                  {statusLabels[queen.status] || queen.status}
                </Badge>
              </div>
              {queen.currentHive && (
                <Link
                  href={`/hives/${queen.currentHive.id}`}
                  className="text-gray-500 hover:text-honey-600 text-sm"
                >
                  Kube {queen.currentHive.hiveNumber} - {queen.currentHive.apiaryName}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowStatusModal(true)}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Status
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMoveModal(true)}>
            <MoveRight className="w-4 h-4 mr-1" />
            Flytt
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
            <Edit className="w-4 h-4 mr-1" />
            Rediger
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Er du sikker pa at du vil slette denne dronningen?')) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle>Stamdata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <InfoRow label="Ar" value={queen.year.toString()} />
              <InfoRow label="Rase" value={raceLabels[queen.race || ''] || queen.race || '-'} />
              <InfoRow label="Opprinnelse" value={originLabels[queen.origin] || queen.origin} />
              <InfoRow label="Merket" value={queen.marked ? 'Ja' : 'Nei'} />
              {queen.color && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Farge</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: getQueenColorHex(queen.color) }}
                    />
                    <span className="font-medium capitalize">{queen.color}</span>
                  </div>
                </div>
              )}
              <InfoRow label="Klippet" value={queen.clipped ? 'Ja' : 'Nei'} />
              {queen.rating && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Vurdering</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= queen.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status & mating */}
        <Card>
          <CardHeader>
            <CardTitle>Status og parring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <InfoRow label="Status" value={statusLabels[queen.status] || queen.status} />
              {queen.statusDate && (
                <InfoRow label="Status dato" value={formatDate(queen.statusDate)} />
              )}
              {queen.matingDate && (
                <InfoRow label="Parringsdato" value={formatDate(queen.matingDate)} />
              )}
              {queen.matingStation && (
                <InfoRow label="Parringsstasjon" value={queen.matingStation} />
              )}
              {queen.introducedDate && (
                <InfoRow label="Introdusert" value={formatDate(queen.introducedDate)} />
              )}
              {queen.temperament && (
                <InfoRow label="Temperament" value={temperamentLabels[queen.temperament] || queen.temperament} />
              )}
              {queen.productivity && (
                <InfoRow label="Produktivitet" value={productivityLabels[queen.productivity] || queen.productivity} />
              )}
              {queen.swarmTendency && (
                <InfoRow label="Svermetendens" value={productivityLabels[queen.swarmTendency] || queen.swarmTendency} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lineage */}
      <Card>
        <CardHeader>
          <CardTitle>Slekt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mother */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Mor</h4>
              {queen.mother ? (
                <Link
                  href={`/queens/${queen.mother.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Crown className="w-5 h-5 text-honey-500" />
                  <div>
                    <p className="font-medium text-gray-900">{queen.mother.queenCode}</p>
                    <p className="text-sm text-gray-500">
                      {queen.mother.year} - {raceLabels[queen.mother.race || ''] || queen.mother.race || ''}
                      {' '}
                      <Badge variant={statusVariants[queen.mother.status] || 'default'} className="text-xs">
                        {statusLabels[queen.mother.status] || queen.mother.status}
                      </Badge>
                    </p>
                  </div>
                </Link>
              ) : (
                <p className="text-gray-400 text-sm p-3">Ingen mor registrert</p>
              )}
            </div>

            {/* Daughters */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">
                Dotre ({queen.daughters.length})
              </h4>
              {queen.daughters.length > 0 ? (
                <div className="space-y-2">
                  {queen.daughters.map((d) => (
                    <Link
                      key={d.id}
                      href={`/queens/${d.id}`}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Crown className="w-4 h-4 text-honey-400" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{d.queenCode}</p>
                        <p className="text-xs text-gray-500">
                          {d.year} - {raceLabels[d.race || ''] || d.race || ''}
                          {' '}
                          <Badge variant={statusVariants[d.status] || 'default'} className="text-xs">
                            {statusLabels[d.status] || d.status}
                          </Badge>
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm p-3">Ingen dotre registrert</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hive history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-honey-500" />
            Kubehistorikk
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queen.hiveHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Ingen kubehistorikk</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {queen.hiveHistory.map((entry) => (
                  <div key={entry.id} className="flex gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-honey-100 border-2 border-white flex items-center justify-center z-10">
                      <MoveRight className="w-3.5 h-3.5 text-honey-600" />
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {actionLabels[entry.action] || entry.action}
                        </span>
                        <span className="text-sm text-gray-500">
                          Kube {entry.hive.hiveNumber} - {entry.hive.apiaryName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
                      {entry.reason && (
                        <p className="text-sm text-gray-500 mt-1">{entry.reason}</p>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-gray-400 mt-0.5">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {queen.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notater</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{queen.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Move modal */}
      <MoveQueenModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        queenId={queenId}
        hives={hives}
        currentHiveId={queen.currentHiveId}
      />

      {/* Edit modal */}
      <EditQueenModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        queen={queen}
      />

      {/* Status modal */}
      <StatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        queenId={queenId}
        currentStatus={queen.status}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function MoveQueenModal({
  isOpen,
  onClose,
  queenId,
  hives,
  currentHiveId,
}: {
  isOpen: boolean;
  onClose: () => void;
  queenId: string;
  hives: Hive[];
  currentHiveId?: string;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    hiveId: '',
    date: new Date().toISOString().slice(0, 10),
    reason: '',
    notes: '',
  });

  const moveMutation = useMutation({
    mutationFn: (data: { hiveId: string; date: string; reason?: string; notes?: string }) =>
      queensApi.move(queenId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queen', queenId] });
      queryClient.invalidateQueries({ queryKey: ['queens'] });
      onClose();
      setFormData({ hiveId: '', date: new Date().toISOString().slice(0, 10), reason: '', notes: '' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hiveId) return;
    moveMutation.mutate({
      hiveId: formData.hiveId,
      date: new Date(formData.date).toISOString(),
      reason: formData.reason || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Flytt dronning">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ny kube *</label>
          <select
            value={formData.hiveId}
            onChange={(e) => setFormData((prev) => ({ ...prev, hiveId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            required
          >
            <option value="">Velg kube...</option>
            {hives
              .filter((h) => h.id !== currentHiveId)
              .map((hive) => (
                <option key={hive.id} value={hive.id}>
                  Kube {hive.hiveNumber} - {hive.apiary.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Dato *</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            required
          />
        </div>
        <Input
          label="Arsak"
          value={formData.reason}
          onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
          placeholder="F.eks. Dronningbytte"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notater</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Avbryt</Button>
          <Button type="submit" disabled={moveMutation.isPending}>
            {moveMutation.isPending ? 'Flytter...' : 'Flytt dronning'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditQueenModal({
  isOpen,
  onClose,
  queen,
}: {
  isOpen: boolean;
  onClose: () => void;
  queen: NonNullable<Awaited<ReturnType<typeof queensApi.get>>['data']>;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    queenCode: queen.queenCode,
    year: queen.year,
    race: queen.race || '',
    marked: queen.marked,
    clipped: queen.clipped,
    matingDate: queen.matingDate ? new Date(queen.matingDate).toISOString().slice(0, 10) : '',
    matingStation: queen.matingStation || '',
    rating: queen.rating || 0,
    temperament: queen.temperament || '',
    productivity: queen.productivity || '',
    swarmTendency: queen.swarmTendency || '',
    notes: queen.notes || '',
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof queensApi.update>[1]) =>
      queensApi.update(queen.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queen', queen.id] });
      queryClient.invalidateQueries({ queryKey: ['queens'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      queenCode: formData.queenCode,
      year: formData.year,
      race: formData.race || null,
      marked: formData.marked,
      clipped: formData.clipped,
      matingDate: formData.matingDate ? new Date(formData.matingDate).toISOString() : null,
      matingStation: formData.matingStation || null,
      rating: formData.rating || null,
      temperament: formData.temperament || null,
      productivity: formData.productivity || null,
      swarmTendency: formData.swarmTendency || null,
      notes: formData.notes || null,
    });
  };

  const raceLabels: Record<string, string> = {
    buckfast: 'Buckfast',
    carnica: 'Carnica',
    italian: 'Italiensk',
    nordic: 'Nordisk brunbie',
    caucasian: 'Kaukasisk',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rediger dronning" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Dronningkode"
            value={formData.queenCode}
            onChange={(e) => setFormData((prev) => ({ ...prev, queenCode: e.target.value }))}
          />
          <Input
            label="Ar"
            type="number"
            value={formData.year.toString()}
            onChange={(e) => setFormData((prev) => ({ ...prev, year: parseInt(e.target.value) || queen.year }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rase</label>
            <select
              value={formData.race}
              onChange={(e) => setFormData((prev) => ({ ...prev, race: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Velg rase...</option>
              {Object.entries(raceLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Parringsdato</label>
            <input
              type="date"
              value={formData.matingDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, matingDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            />
          </div>
        </div>
        <Input
          label="Parringsstasjon"
          value={formData.matingStation}
          onChange={(e) => setFormData((prev) => ({ ...prev, matingStation: e.target.value }))}
        />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.marked}
              onChange={(e) => setFormData((prev) => ({ ...prev, marked: e.target.checked }))}
              className="rounded border-gray-300 text-honey-600 focus:ring-honey-500"
            />
            <span className="text-sm text-gray-700">Merket</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.clipped}
              onChange={(e) => setFormData((prev) => ({ ...prev, clipped: e.target.checked }))}
              className="rounded border-gray-300 text-honey-600 focus:ring-honey-500"
            />
            <span className="text-sm text-gray-700">Klippet</span>
          </label>
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Vurdering</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, rating: prev.rating === s ? 0 : s }))}
                className="p-1"
              >
                <Star
                  className={`w-6 h-6 ${s <= formData.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Traits */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Temperament</label>
            <select
              value={formData.temperament}
              onChange={(e) => setFormData((prev) => ({ ...prev, temperament: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">-</option>
              <option value="calm">Rolig</option>
              <option value="nervous">Nervos</option>
              <option value="aggressive">Aggressiv</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Produktivitet</label>
            <select
              value={formData.productivity}
              onChange={(e) => setFormData((prev) => ({ ...prev, productivity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">-</option>
              <option value="low">Lav</option>
              <option value="medium">Medium</option>
              <option value="high">Hoy</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Svermetendens</label>
            <select
              value={formData.swarmTendency}
              onChange={(e) => setFormData((prev) => ({ ...prev, swarmTendency: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">-</option>
              <option value="low">Lav</option>
              <option value="medium">Medium</option>
              <option value="high">Hoy</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notater</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Avbryt</Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Lagrer...' : 'Lagre endringer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StatusModal({
  isOpen,
  onClose,
  queenId,
  currentStatus,
}: {
  isOpen: boolean;
  onClose: () => void;
  queenId: string;
  currentStatus: string;
}) {
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState(currentStatus);

  const updateMutation = useMutation({
    mutationFn: (status: string) => queensApi.update(queenId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queen', queenId] });
      queryClient.invalidateQueries({ queryKey: ['queens'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatus !== currentStatus) {
      updateMutation.mutate(newStatus);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Endre status">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ny status</label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Avbryt</Button>
          <Button type="submit" disabled={updateMutation.isPending || newStatus === currentStatus}>
            {updateMutation.isPending ? 'Lagrer...' : 'Oppdater status'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
