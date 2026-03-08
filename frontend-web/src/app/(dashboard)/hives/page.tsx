'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hivesApi, apiariesApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Box, X } from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, getStrengthColor, getStatusColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SkeletonCard } from '@/components/ui/skeleton';

export default function HivesPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const preselectedApiaryId = searchParams.get('apiaryId');

  const [showCreateModal, setShowCreateModal] = useState(!!preselectedApiaryId);
  const [newHive, setNewHive] = useState({
    apiaryId: preselectedApiaryId || '',
    hiveNumber: '',
    hiveType: 'langstroth',
  });
  const [filters, setFilters] = useState({
    apiaryId: '',
    status: '',
  });

  const { data: hivesResponse, isLoading } = useQuery({
    queryKey: ['hives', filters],
    queryFn: () => hivesApi.list({
      ...(filters.apiaryId && { apiaryId: filters.apiaryId }),
      ...(filters.status && { status: filters.status }),
    }),
  });

  const { data: apiariesResponse } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: hivesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hives'] });
      setShowCreateModal(false);
      setNewHive({ apiaryId: '', hiveNumber: '', hiveType: 'langstroth' });
      toast.success('Kube opprettet!');
    },
    onError: (err: unknown) => {
      const error = err as { error?: { message?: string } };
      toast.error(error?.error?.message || 'Kunne ikke opprette kube');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHive.apiaryId) {
      toast.error('Velg en bigård');
      return;
    }
    createMutation.mutate({
      apiaryId: newHive.apiaryId,
      hiveNumber: newHive.hiveNumber,
      hiveType: newHive.hiveType as 'langstroth' | 'topbar' | 'warre',
    });
  };

  const hives = hivesResponse?.data || [];
  const apiaries = apiariesResponse?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kuber</h1>
          <p className="text-gray-500">Administrer dine bikuber</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny kube
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <select
              value={filters.apiaryId}
              onChange={(e) => setFilters({ ...filters, apiaryId: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Alle bigårder</option>
              {apiaries.map((apiary) => (
                <option key={apiary.id} value={apiary.id}>{apiary.name}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Alle statuser</option>
              <option value="active">Aktiv</option>
              <option value="nuc">Avlegger</option>
              <option value="inactive">Inaktiv</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : hives.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Ingen kuber</h3>
            <p className="text-gray-500 mb-4">Legg til din første bikube</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Opprett kube
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hives.map((hive) => (
            <Link key={hive.id} href={`/hives/${hive.id}`}>
              <Card className="h-full hover:border-honey-300 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-honey-100 rounded-lg flex items-center justify-center">
                        <span className="text-honey-700 font-bold">{hive.hiveNumber}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Kube {hive.hiveNumber}</h3>
                        <p className="text-sm text-gray-500">{hive.apiary.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', getStatusColor(hive.status))}>
                      {hive.status === 'active' ? 'Aktiv' : hive.status === 'nuc' ? 'Avlegger' : hive.status}
                    </span>
                    {hive.strength && (
                      <span className={cn('px-2 py-1 rounded text-xs font-medium', getStrengthColor(hive.strength))}>
                        {hive.strength === 'strong' ? 'Sterk' : hive.strength === 'medium' ? 'Medium' : 'Svak'}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    {hive.queen?.year && (
                      <p>Dronning: {hive.queen.year} {hive.queen.race && `(${hive.queen.race})`}</p>
                    )}
                    {hive.lastInspection && (
                      <p>Sist inspisert: {formatDate(hive.lastInspection.date)}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 text-xs text-gray-500">
                    <span>{hive.boxCount} {hive.boxCount === 1 ? 'kasse' : 'kasser'}</span>
                    <span>{hive.stats.totalInspections} inspeksjoner</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Ny kube</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bigård *
                  </label>
                  <select
                    value={newHive.apiaryId}
                    onChange={(e) => setNewHive({ ...newHive, apiaryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
                    required
                  >
                    <option value="">Velg bigård</option>
                    {apiaries.map((apiary) => (
                      <option key={apiary.id} value={apiary.id}>{apiary.name}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Kubenummer *"
                  value={newHive.hiveNumber}
                  onChange={(e) => setNewHive({ ...newHive, hiveNumber: e.target.value })}
                  placeholder="f.eks. K12"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kubetype
                  </label>
                  <select
                    value={newHive.hiveType}
                    onChange={(e) => setNewHive({ ...newHive, hiveType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
                  >
                    <option value="langstroth">Langstroth</option>
                    <option value="topbar">Top Bar</option>
                    <option value="warre">Warré</option>
                  </select>
                </div>
              </CardContent>
              <div className="flex justify-end gap-3 p-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Avbryt
                </Button>
                <Button type="submit" isLoading={createMutation.isPending}>
                  Opprett
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
