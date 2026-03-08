'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiariesApi, weatherApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Plus, Box, Sun, Cloud, CloudRain, CloudSnow, Wind, Thermometer, Pencil, LocateFixed } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatDate, getStrengthColor, getStatusColor } from '@/lib/utils';

function getWeatherIcon(conditionCode: string) {
  if (conditionCode.includes('snow') || conditionCode.includes('sleet')) return CloudSnow;
  if (conditionCode.includes('rain')) return CloudRain;
  if (conditionCode.includes('cloud') || conditionCode.includes('fog')) return Cloud;
  return Sun;
}

export default function ApiaryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiaryId = params.id as string;
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', locationName: '', lat: '', lng: '', type: 'permanent', active: true });
  const [geoLoading, setGeoLoading] = useState(false);

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['apiary', apiaryId],
    queryFn: () => apiariesApi.get(apiaryId),
  });

  const apiaryMaybe = response?.data;
  const hasLocation = !!(apiaryMaybe?.location?.lat && apiaryMaybe?.location?.lng);

  const { data: weatherRes, isLoading: weatherLoading } = useQuery({
    queryKey: ['weather', 'current', apiaryMaybe?.location?.lat, apiaryMaybe?.location?.lng],
    queryFn: () => weatherApi.current(apiaryMaybe!.location!.lat!, apiaryMaybe!.location!.lng!),
    enabled: hasLocation,
    staleTime: 10 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiariesApi.update>[1]) =>
      apiariesApi.update(apiaryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiary', apiaryId] });
      queryClient.invalidateQueries({ queryKey: ['apiaries'] });
      setShowEditModal(false);
      toast.success('Bigård oppdatert!');
    },
    onError: (err: unknown) => {
      const error = err as { error?: { message?: string } };
      toast.error(error?.error?.message || 'Kunne ikke oppdatere bigård');
    },
  });

  const openEditModal = () => {
    const data = response?.data;
    if (!data) return;
    setEditForm({
      name: data.name,
      description: data.description || '',
      locationName: data.location?.name || '',
      lat: data.location?.lat?.toString() || '',
      lng: data.location?.lng?.toString() || '',
      type: data.type,
      active: data.active,
    });
    setShowEditModal(true);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error('Geolokasjon er ikke støttet i denne nettleseren');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setEditForm((prev) => ({
          ...prev,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }));
        setGeoLoading(false);
        toast.success('Posisjon hentet!');
      },
      () => {
        setGeoLoading(false);
        toast.error('Kunne ikke hente posisjon. Sjekk tillatelser.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name: editForm.name,
      description: editForm.description || undefined,
      location: {
        name: editForm.locationName || undefined,
        lat: editForm.lat ? parseFloat(editForm.lat) : undefined,
        lng: editForm.lng ? parseFloat(editForm.lng) : undefined,
      },
      type: editForm.type,
      active: editForm.active,
    });
  };

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
        <p className="text-gray-500 mb-4">Kunne ikke laste bigård</p>
        <Button variant="outline" onClick={() => router.push('/apiaries')}>
          Tilbake til bigårder
        </Button>
      </div>
    );
  }

  const apiary = response.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/apiaries')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{apiary.name}</h1>
          {apiary.location?.name && (
            <p className="text-gray-500 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {apiary.location.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={apiary.active ? 'success' : 'default'}>
            {apiary.active ? 'Aktiv' : 'Inaktiv'}
          </Badge>
          <Button variant="outline" size="sm" onClick={openEditModal}>
            <Pencil className="w-4 h-4 mr-1" />
            Rediger
          </Button>
        </div>
      </div>

      {/* Compact weather card */}
      {hasLocation && (
        <Card>
          <CardContent className="py-3 px-4">
            {weatherLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ) : weatherRes?.data ? (
              <div className="flex items-center gap-4">
                {(() => {
                  const Icon = getWeatherIcon(weatherRes.data.conditionCode);
                  return <Icon className="w-6 h-6 text-blue-500" />;
                })()}
                <span className="text-lg font-semibold text-gray-900">
                  {weatherRes.data.temperature.toFixed(1)}°C
                </span>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Wind className="w-3.5 h-3.5" />
                  {weatherRes.data.windSpeed.toFixed(1)} m/s
                </span>
                <span className="text-sm text-gray-500 capitalize">
                  {weatherRes.data.condition}
                </span>
                <span className="ml-auto text-xs text-gray-400">YR.no</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Info card */}
      {apiary.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600">{apiary.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Hives */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kuber ({apiary.hives.length})</CardTitle>
          <Link href={`/hives?apiaryId=${apiaryId}`}>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Ny kube
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {apiary.hives.length === 0 ? (
            <div className="text-center py-8">
              <Box className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">Ingen kuber i denne bigården</p>
              <Link href={`/hives?apiaryId=${apiaryId}`}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Legg til kube
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {apiary.hives.map((hive) => (
                <Link
                  key={hive.id}
                  href={`/hives/${hive.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-honey-100 rounded-lg flex items-center justify-center">
                      <span className="text-honey-700 font-bold text-sm">{hive.hiveNumber}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Kube {hive.hiveNumber}</p>
                      {hive.lastInspection && (
                        <p className="text-xs text-gray-500">
                          Sist inspisert: {formatDate(hive.lastInspection)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hive.strength && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStrengthColor(hive.strength)}`}>
                        {hive.strength === 'strong' ? 'Sterk' : hive.strength === 'medium' ? 'Medium' : 'Svak'}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(hive.status)}`}>
                      {hive.status === 'active' ? 'Aktiv' : hive.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collaborators */}
      {apiary.collaborators && apiary.collaborators.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Samarbeidspartnere</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {apiary.collaborators.map((collab) => (
                <div key={collab.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-sm">
                        {collab.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-gray-900">{collab.name}</span>
                  </div>
                  <Badge variant={collab.role === 'owner' ? 'info' : 'default'}>
                    {collab.role === 'owner' ? 'Eier' : collab.role === 'collaborator' ? 'Samarbeider' : 'Seer'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Rediger bigård"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Navn *"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
          <Input
            label="Lokasjon (stedsnavn)"
            value={editForm.locationName}
            onChange={(e) => setEditForm({ ...editForm, locationName: e.target.value })}
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
                value={editForm.lat}
                onChange={(e) => setEditForm({ ...editForm, lat: e.target.value })}
                placeholder="60.3913"
              />
              <Input
                label="Lengdegrad"
                type="number"
                step="any"
                value={editForm.lng}
                onChange={(e) => setEditForm({ ...editForm, lng: e.target.value })}
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
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500 focus:border-honey-500"
              rows={3}
              placeholder="Valgfri beskrivelse..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={editForm.type}
              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500 focus:border-honey-500"
            >
              <option value="permanent">Fast bigård</option>
              <option value="seasonal">Sesongbigård</option>
              <option value="heather_route">Lyngtrekk</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.active}
              onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-honey-500 focus:ring-honey-500"
            />
            <span className="text-sm text-gray-700">Aktiv</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
              Avbryt
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Lagre endringer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
