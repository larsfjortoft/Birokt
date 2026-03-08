'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiariesApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, X, LocateFixed } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SkeletonCard } from '@/components/ui/skeleton';

export default function ApiariesPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newApiary, setNewApiary] = useState({ name: '', description: '', locationName: '', lat: '', lng: '' });
  const [geoLoading, setGeoLoading] = useState(false);
  const { data: response, isLoading } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; location?: { name?: string; lat?: number; lng?: number } }) =>
      apiariesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiaries'] });
      setShowCreateModal(false);
      setNewApiary({ name: '', description: '', locationName: '', lat: '', lng: '' });
      toast.success('Bigård opprettet!');
    },
    onError: (err: unknown) => {
      const error = err as { error?: { message?: string } };
      toast.error(error?.error?.message || 'Kunne ikke opprette bigård');
    },
  });

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error('Geolokasjon er ikke støttet i denne nettleseren');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewApiary((prev) => ({
          ...prev,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }));
        setGeoLoading(false);
        toast.success('Posisjon hentet!');
      },
      (error) => {
        setGeoLoading(false);
        toast.error('Kunne ikke hente posisjon. Sjekk tillatelser.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const hasLocation = newApiary.locationName || newApiary.lat || newApiary.lng;
    createMutation.mutate({
      name: newApiary.name,
      description: newApiary.description || undefined,
      location: hasLocation ? {
        name: newApiary.locationName || undefined,
        lat: newApiary.lat ? parseFloat(newApiary.lat) : undefined,
        lng: newApiary.lng ? parseFloat(newApiary.lng) : undefined,
      } : undefined,
    });
  };

  const apiaries = response?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bigårder</h1>
          <p className="text-gray-500">Administrer dine bigårder</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny bigård
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : apiaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Ingen bigårder</h3>
            <p className="text-gray-500 mb-4">Kom i gang ved å opprette din første bigård</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Opprett bigård
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {apiaries.map((apiary) => (
            <Link key={apiary.id} href={`/apiaries/${apiary.id}`}>
              <Card className="h-full hover:border-honey-300 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{apiary.name}</h3>
                      {apiary.location?.name && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {apiary.location.name}
                        </p>
                      )}
                    </div>
                    <Badge variant={apiary.active ? 'success' : 'default'}>
                      {apiary.active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>

                  {apiary.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {apiary.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-sm text-gray-500">
                      {apiary.hiveCount} {apiary.hiveCount === 1 ? 'kube' : 'kuber'}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      {apiary.stats.healthy > 0 && (
                        <span className="text-green-600">{apiary.stats.healthy} ok</span>
                      )}
                      {apiary.stats.warning > 0 && (
                        <span className="text-yellow-600">{apiary.stats.warning} adv.</span>
                      )}
                      {apiary.stats.critical > 0 && (
                        <span className="text-red-600">{apiary.stats.critical} krit.</span>
                      )}
                    </div>
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
              <h2 className="text-lg font-semibold">Ny bigård</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <CardContent className="space-y-4 pt-4">
                <Input
                  label="Navn *"
                  value={newApiary.name}
                  onChange={(e) => setNewApiary({ ...newApiary, name: e.target.value })}
                  placeholder="f.eks. Heimebigård"
                  required
                />
                <Input
                  label="Lokasjon (stedsnavn)"
                  value={newApiary.locationName}
                  onChange={(e) => setNewApiary({ ...newApiary, locationName: e.target.value })}
                  placeholder="f.eks. Sandsli, Bergen"
                />
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Koordinater
                    </label>
                    <button
                      type="button"
                      onClick={handleGeolocate}
                      disabled={geoLoading}
                      className="flex items-center gap-1 text-xs text-honey-600 hover:text-honey-700 disabled:opacity-50"
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      {geoLoading ? 'Henter...' : 'Bruk min posisjon'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Breddegrad"
                      type="number"
                      step="any"
                      value={newApiary.lat}
                      onChange={(e) => setNewApiary({ ...newApiary, lat: e.target.value })}
                      placeholder="60.3913"
                    />
                    <Input
                      label="Lengdegrad"
                      type="number"
                      step="any"
                      value={newApiary.lng}
                      onChange={(e) => setNewApiary({ ...newApiary, lng: e.target.value })}
                      placeholder="5.3221"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Koordinater brukes til å hente værdata fra YR.no
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beskrivelse
                  </label>
                  <textarea
                    value={newApiary.description}
                    onChange={(e) => setNewApiary({ ...newApiary, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500 focus:border-honey-500"
                    rows={3}
                    placeholder="Valgfri beskrivelse..."
                  />
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
