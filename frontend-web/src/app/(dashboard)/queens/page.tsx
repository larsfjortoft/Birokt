'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queensApi, hivesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Crown, Plus, Search, Star } from 'lucide-react';
import Link from 'next/link';
import { formatDate, getQueenColorHex } from '@/lib/utils';

interface Queen {
  id: string;
  queenCode: string;
  year: number;
  race?: string;
  color?: string;
  marked: boolean;
  clipped: boolean;
  origin: string;
  status: string;
  statusDate: string;
  rating?: number;
  temperament?: string;
  productivity?: string;
  swarmTendency?: string;
  mother?: { id: string; queenCode: string } | null;
  currentHive?: { id: string; hiveNumber: string; apiaryName: string } | null;
  daughterCount: number;
  notes?: string;
  createdAt: string;
}

interface Hive {
  id: string;
  hiveNumber: string;
  apiary: { id: string; name: string };
}

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

export default function QueensPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const queryParams: Record<string, string> = {};
  if (filterStatus !== 'all') queryParams.status = filterStatus;
  if (searchQuery) queryParams.search = searchQuery;

  const { data: queensResponse, isLoading } = useQuery({
    queryKey: ['queens', queryParams],
    queryFn: () => queensApi.list(queryParams),
  });

  const { data: hivesResponse } = useQuery({
    queryKey: ['hives'],
    queryFn: () => hivesApi.list(),
  });

  const queens = (queensResponse?.data || []) as Queen[];
  const hives = (hivesResponse?.data || []) as Hive[];

  const totalQueens = queens.length;
  const activeQueens = queens.filter(q => q.status === 'laying').length;
  const thisYearQueens = queens.filter(q => q.year === new Date().getFullYear()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dronninger</h1>
          <p className="text-gray-500">Administrer dronningregister og slektslinjer</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny dronning
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-honey-100 rounded-lg">
                <Crown className="w-6 h-6 text-honey-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Totalt dronninger</p>
                <p className="text-2xl font-bold">{totalQueens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Crown className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Aktive (leggende)</p>
                <p className="text-2xl font-bold">{activeQueens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Crown className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">I ar ({new Date().getFullYear()})</p>
                <p className="text-2xl font-bold">{thisYearQueens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sok etter dronningkode, rase..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'laying', 'virgin', 'mated', 'failed', 'dead'].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all' ? 'Alle' : statusLabels[status] || status}
            </Button>
          ))}
        </div>
      </div>

      {/* Queens list */}
      <Card>
        <CardHeader>
          <CardTitle>Dronningoversikt</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Laster dronninger...</p>
          ) : queens.length === 0 ? (
            <div className="text-center py-12">
              <Crown className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Ingen dronninger registrert</p>
              <p className="text-sm text-gray-400 mb-4">Start med a registrere din forste dronning</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Legg til dronning
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {queens.map((queen) => (
                <Link
                  key={queen.id}
                  href={`/queens/${queen.id}`}
                  className="py-4 flex items-start justify-between hover:bg-gray-50 px-2 -mx-2 rounded-lg transition-colors block"
                >
                  <div className="flex gap-4">
                    <div className="p-2 bg-honey-100 rounded-lg relative">
                      <Crown className="w-5 h-5 text-honey-600" />
                      {queen.color && (
                        <div
                          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white"
                          style={{ backgroundColor: getQueenColorHex(queen.color) }}
                        />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{queen.queenCode}</h3>
                        <Badge variant={statusVariants[queen.status] || 'default'}>
                          {statusLabels[queen.status] || queen.status}
                        </Badge>
                        {queen.marked && (
                          <Badge variant="secondary">Merket</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{queen.year}</span>
                        {queen.race && <span>{raceLabels[queen.race] || queen.race}</span>}
                        {queen.origin && <span>{originLabels[queen.origin] || queen.origin}</span>}
                      </div>
                      {queen.currentHive && (
                        <p className="text-sm text-gray-500 mt-1">
                          Kube {queen.currentHive.hiveNumber} - {queen.currentHive.apiaryName}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {queen.mother && (
                          <span className="text-xs text-gray-400">
                            Mor: {queen.mother.queenCode}
                          </span>
                        )}
                        {queen.daughterCount > 0 && (
                          <span className="text-xs text-gray-400">
                            {queen.daughterCount} dotre
                          </span>
                        )}
                        {queen.rating && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-500">
                            <Star className="w-3 h-3 fill-current" />
                            {queen.rating}/5
                          </span>
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

      {/* Create modal */}
      <CreateQueenModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        hives={hives}
        queens={queens}
      />
    </div>
  );
}

function CreateQueenModal({
  isOpen,
  onClose,
  hives,
  queens,
}: {
  isOpen: boolean;
  onClose: () => void;
  hives: Hive[];
  queens: Queen[];
}) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    queenCode: '',
    year: currentYear,
    race: '',
    color: '',
    marked: false,
    clipped: false,
    origin: 'own_production',
    status: 'virgin',
    currentHiveId: '',
    motherId: '',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof queensApi.create>[0]) => queensApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queens'] });
      onClose();
      setFormData({
        queenCode: '',
        year: currentYear,
        race: '',
        color: '',
        marked: false,
        clipped: false,
        origin: 'own_production',
        status: 'virgin',
        currentHiveId: '',
        motherId: '',
        notes: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.queenCode) return;

    createMutation.mutate({
      queenCode: formData.queenCode,
      year: formData.year,
      race: formData.race || undefined,
      color: formData.color || undefined,
      marked: formData.marked,
      clipped: formData.clipped,
      origin: formData.origin,
      status: formData.status,
      currentHiveId: formData.currentHiveId || undefined,
      motherId: formData.motherId || undefined,
      notes: formData.notes || undefined,
    });
  };

  const colorOptions = [
    { value: 'white', label: 'Hvit', hex: '#FFFFFF' },
    { value: 'yellow', label: 'Gul', hex: '#FFD700' },
    { value: 'red', label: 'Rod', hex: '#FF0000' },
    { value: 'green', label: 'Gronn', hex: '#00FF00' },
    { value: 'blue', label: 'Bla', hex: '#0000FF' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ny dronning" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Queen code and year */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Dronningkode *"
            value={formData.queenCode}
            onChange={(e) => setFormData((prev) => ({ ...prev, queenCode: e.target.value }))}
            placeholder="F.eks. Q-2025-001"
            required
          />
          <Input
            label="Ar *"
            type="number"
            min="2000"
            max="2100"
            value={formData.year.toString()}
            onChange={(e) => setFormData((prev) => ({ ...prev, year: parseInt(e.target.value) || currentYear }))}
            required
          />
        </div>

        {/* Race and origin */}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Opprinnelse</label>
            <select
              value={formData.origin}
              onChange={(e) => setFormData((prev) => ({ ...prev, origin: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              {Object.entries(originLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Merkefarge</label>
          <div className="flex gap-2">
            {colorOptions.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, color: prev.color === c.value ? '' : c.value, marked: prev.color === c.value ? prev.marked : true }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  formData.color === c.value
                    ? 'bg-honey-100 border-honey-500 text-honey-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: c.hex }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Marked and clipped */}
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

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Hive and mother */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kube</label>
            <select
              value={formData.currentHiveId}
              onChange={(e) => setFormData((prev) => ({ ...prev, currentHiveId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Ingen kube</option>
              {hives.map((hive) => (
                <option key={hive.id} value={hive.id}>
                  Kube {hive.hiveNumber} - {hive.apiary.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mor</label>
            <select
              value={formData.motherId}
              onChange={(e) => setFormData((prev) => ({ ...prev, motherId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Ingen mor</option>
              {queens.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.queenCode} ({q.year})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notater</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500 resize-none"
            placeholder="Tilleggsinformasjon..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Lagrer...' : 'Lagre dronning'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
