'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedingsApi, hivesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Droplets, Plus, Calendar, Trash2, Scale } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Feeding {
  id: string;
  hive: { id: string; hiveNumber: string; apiaryName: string };
  feedingDate: string;
  feedType: string;
  amountKg: number;
  sugarConcentration?: number;
  reason?: string;
  notes?: string;
  createdAt: string;
}

interface Hive {
  id: string;
  hiveNumber: string;
  apiary: { id: string; name: string };
}

const feedTypes = [
  { value: 'sugar_syrup', label: 'Sukkerlake' },
  { value: 'sugar_dough', label: 'Sukkerdeig/Fondant' },
  { value: 'ready_feed', label: 'Ferdigfôr' },
  { value: 'honey', label: 'Honning' },
  { value: 'pollen_substitute', label: 'Pollenerstatning' },
  { value: 'other', label: 'Annet' },
];

const feedReasons = [
  { value: 'winter_prep', label: 'Vinterforbereding' },
  { value: 'spring_stimulation', label: 'Vårstimulering' },
  { value: 'emergency', label: 'Nødforing' },
  { value: 'nuc_support', label: 'Avleggerstøtte' },
  { value: 'other', label: 'Annet' },
];

export default function FeedingsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: feedingsResponse, isLoading } = useQuery({
    queryKey: ['feedings'],
    queryFn: () => feedingsApi.list(),
  });

  const { data: hivesResponse } = useQuery({
    queryKey: ['hives'],
    queryFn: () => hivesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => feedingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedings'] });
    },
  });

  const feedings = (feedingsResponse?.data || []) as Feeding[];
  const hives = (hivesResponse?.data || []) as Hive[];

  const totalAmountKg = feedings.reduce((sum, f) => sum + f.amountKg, 0);
  const thisMonthFeedings = feedings.filter((f) => {
    const date = new Date(f.feedingDate);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const getFeedTypeLabel = (type: string) => {
    return feedTypes.find((t) => t.value === type)?.label || type;
  };

  const getReasonLabel = (reason: string) => {
    return feedReasons.find((r) => r.value === reason)?.label || reason;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Foring</h1>
          <p className="text-gray-500">Administrer foring av bier</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny foring
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Droplets className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Totalt foringer</p>
                <p className="text-2xl font-bold">{feedings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Scale className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total mengde</p>
                <p className="text-2xl font-bold">{totalAmountKg.toFixed(1)} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Denne måneden</p>
                <p className="text-2xl font-bold">{thisMonthFeedings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedings list */}
      <Card>
        <CardHeader>
          <CardTitle>Foringshistorikk</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Laster foringer...</p>
          ) : feedings.length === 0 ? (
            <div className="text-center py-12">
              <Droplets className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen foringer registrert</p>
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Legg til foring
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {feedings.map((feeding) => (
                <div key={feeding.id} className="py-4 flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Droplets className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {getFeedTypeLabel(feeding.feedType)}
                        </h3>
                        <Badge variant="secondary">{feeding.amountKg} kg</Badge>
                        {feeding.reason && (
                          <Badge variant="info">{getReasonLabel(feeding.reason)}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Kube {feeding.hive.hiveNumber} - {feeding.hive.apiaryName}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(feeding.feedingDate)}
                        </span>
                        {feeding.sugarConcentration && (
                          <span>Sukkerkonsentrasjon: {feeding.sugarConcentration}%</span>
                        )}
                      </div>
                      {feeding.notes && (
                        <p className="text-sm text-gray-500 mt-1">{feeding.notes}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Er du sikker på at du vil slette denne foringen?')) {
                        deleteMutation.mutate(feeding.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create modal */}
      <CreateFeedingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        hives={hives}
      />
    </div>
  );
}

function CreateFeedingModal({
  isOpen,
  onClose,
  hives,
}: {
  isOpen: boolean;
  onClose: () => void;
  hives: Hive[];
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    hiveId: '',
    feedingDate: new Date().toISOString().slice(0, 10),
    feedType: 'sugar_syrup',
    amountKg: '',
    sugarConcentration: '',
    reason: '',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof feedingsApi.create>[0]) =>
      feedingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedings'] });
      onClose();
      setFormData({
        hiveId: '',
        feedingDate: new Date().toISOString().slice(0, 10),
        feedType: 'sugar_syrup',
        amountKg: '',
        sugarConcentration: '',
        reason: '',
        notes: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hiveId || !formData.feedingDate || !formData.amountKg) return;

    createMutation.mutate({
      hiveId: formData.hiveId,
      feedingDate: new Date(formData.feedingDate).toISOString(),
      feedType: formData.feedType,
      amountKg: parseFloat(formData.amountKg),
      sugarConcentration: formData.sugarConcentration ? parseFloat(formData.sugarConcentration) : undefined,
      reason: formData.reason || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ny foring" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hive selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Velg kube *
          </label>
          <select
            value={formData.hiveId}
            onChange={(e) => setFormData((prev) => ({ ...prev, hiveId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            required
          >
            <option value="">Velg kube...</option>
            {hives.map((hive) => (
              <option key={hive.id} value={hive.id}>
                Kube {hive.hiveNumber} - {hive.apiary.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dato *
          </label>
          <input
            type="date"
            value={formData.feedingDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, feedingDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            required
          />
        </div>

        {/* Feed type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type foring *
          </label>
          <select
            value={formData.feedType}
            onChange={(e) => setFormData((prev) => ({ ...prev, feedType: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
          >
            {feedTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <Input
          label="Mengde (kg) *"
          type="number"
          step="0.1"
          min="0"
          value={formData.amountKg}
          onChange={(e) => setFormData((prev) => ({ ...prev, amountKg: e.target.value }))}
          placeholder="F.eks. 5"
          required
        />

        {/* Sugar concentration (only for syrup) */}
        {formData.feedType === 'sugar_syrup' && (
          <Input
            label="Sukkerkonsentrasjon (%)"
            type="number"
            min="0"
            max="100"
            value={formData.sugarConcentration}
            onChange={(e) => setFormData((prev) => ({ ...prev, sugarConcentration: e.target.value }))}
            placeholder="F.eks. 60"
          />
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Årsak
          </label>
          <select
            value={formData.reason}
            onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
          >
            <option value="">Velg årsak...</option>
            {feedReasons.map((reason) => (
              <option key={reason.value} value={reason.value}>{reason.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notater
          </label>
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
            {createMutation.isPending ? 'Lagrer...' : 'Lagre foring'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
