'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { treatmentsApi, hivesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Syringe, Plus, AlertTriangle, CheckCircle, Calendar, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Treatment {
  id: string;
  hive: { id: string; hiveNumber: string; apiaryName: string };
  treatmentDate: string;
  productName: string;
  productType?: string;
  target?: string;
  dosage?: string;
  startDate: string;
  endDate?: string;
  withholdingPeriodDays?: number;
  withholdingEndDate?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

interface Hive {
  id: string;
  hiveNumber: string;
  apiary: { id: string; name: string };
}

const productTypes = [
  { value: 'organic_acid', label: 'Organisk syre' },
  { value: 'synthetic', label: 'Syntetisk' },
  { value: 'essential_oil', label: 'Eterisk olje' },
  { value: 'biological', label: 'Biologisk' },
  { value: 'other', label: 'Annet' },
];

const targets = [
  { value: 'varroa', label: 'Varroa' },
  { value: 'nosema', label: 'Nosema' },
  { value: 'foulbrood', label: 'Yngelråte' },
  { value: 'other', label: 'Annet' },
];

const commonProducts = [
  { name: 'Oxalsyre', type: 'organic_acid', target: 'varroa', withholding: 0 },
  { name: 'Maursyre', type: 'organic_acid', target: 'varroa', withholding: 0 },
  { name: 'Apivar', type: 'synthetic', target: 'varroa', withholding: 42 },
  { name: 'Apistan', type: 'synthetic', target: 'varroa', withholding: 42 },
  { name: 'Thymovar', type: 'essential_oil', target: 'varroa', withholding: 0 },
  { name: 'ApiLifeVar', type: 'essential_oil', target: 'varroa', withholding: 0 },
];

export default function TreatmentsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'completed'>('all');

  const { data: treatmentsResponse, isLoading } = useQuery({
    queryKey: ['treatments'],
    queryFn: () => treatmentsApi.list(),
  });

  const { data: hivesResponse } = useQuery({
    queryKey: ['hives'],
    queryFn: () => hivesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => treatmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
    },
  });

  const treatments = (treatmentsResponse?.data || []) as Treatment[];
  const hives = (hivesResponse?.data || []) as Hive[];

  const filteredTreatments = treatments.filter((t) => {
    if (filterActive === 'active') return t.isActive;
    if (filterActive === 'completed') return !t.isActive;
    return true;
  });

  const activeTreatments = treatments.filter((t) => t.isActive);
  const withActiveWithholding = treatments.filter((t) => {
    if (!t.withholdingEndDate) return false;
    return new Date(t.withholdingEndDate) > new Date();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Behandlinger</h1>
          <p className="text-gray-500">Administrer varroabehandlinger og andre behandlinger</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny behandling
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Syringe className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Totalt behandlinger</p>
                <p className="text-2xl font-bold">{treatments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Aktive behandlinger</p>
                <p className="text-2xl font-bold">{activeTreatments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Aktive tilbakeholdelser</p>
                <p className="text-2xl font-bold">{withActiveWithholding.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filterActive === 'all' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilterActive('all')}
        >
          Alle
        </Button>
        <Button
          variant={filterActive === 'active' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilterActive('active')}
        >
          Aktive
        </Button>
        <Button
          variant={filterActive === 'completed' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilterActive('completed')}
        >
          Fullførte
        </Button>
      </div>

      {/* Treatments list */}
      <Card>
        <CardHeader>
          <CardTitle>Behandlingsoversikt</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Laster behandlinger...</p>
          ) : filteredTreatments.length === 0 ? (
            <div className="text-center py-12">
              <Syringe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen behandlinger registrert</p>
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Legg til behandling
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTreatments.map((treatment) => {
                const hasActiveWithholding = treatment.withholdingEndDate &&
                  new Date(treatment.withholdingEndDate) > new Date();

                return (
                  <div key={treatment.id} className="py-4 flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="p-2 bg-honey-100 rounded-lg">
                        <Syringe className="w-5 h-5 text-honey-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{treatment.productName}</h3>
                          {treatment.isActive ? (
                            <Badge variant="success">Aktiv</Badge>
                          ) : (
                            <Badge variant="secondary">Fullført</Badge>
                          )}
                          {hasActiveWithholding && (
                            <Badge variant="warning">Tilbakeholdelse</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          Kube {treatment.hive.hiveNumber} - {treatment.hive.apiaryName}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(treatment.startDate)}
                            {treatment.endDate && ` - ${formatDate(treatment.endDate)}`}
                          </span>
                          {treatment.dosage && (
                            <span>Dose: {treatment.dosage}</span>
                          )}
                        </div>
                        {hasActiveWithholding && treatment.withholdingEndDate && (
                          <p className="text-sm text-amber-600 mt-1">
                            Tilbakeholdelse til: {formatDate(treatment.withholdingEndDate)}
                          </p>
                        )}
                        {treatment.notes && (
                          <p className="text-sm text-gray-500 mt-1">{treatment.notes}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Er du sikker på at du vil slette denne behandlingen?')) {
                          deleteMutation.mutate(treatment.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create modal */}
      <CreateTreatmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        hives={hives}
      />
    </div>
  );
}

function CreateTreatmentModal({
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
    productName: '',
    productType: 'organic_acid',
    target: 'varroa',
    dosage: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    withholdingPeriodDays: 0,
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof treatmentsApi.create>[0]) =>
      treatmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
      onClose();
      setFormData({
        hiveId: '',
        productName: '',
        productType: 'organic_acid',
        target: 'varroa',
        dosage: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        withholdingPeriodDays: 0,
        notes: '',
      });
    },
  });

  const selectProduct = (product: typeof commonProducts[0]) => {
    setFormData((prev) => ({
      ...prev,
      productName: product.name,
      productType: product.type,
      target: product.target,
      withholdingPeriodDays: product.withholding,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hiveId || !formData.productName || !formData.startDate) return;

    createMutation.mutate({
      hiveId: formData.hiveId,
      treatmentDate: new Date(formData.startDate).toISOString(),
      productName: formData.productName,
      productType: formData.productType,
      target: formData.target,
      dosage: formData.dosage || undefined,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      withholdingPeriodDays: formData.withholdingPeriodDays || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ny behandling" size="lg">
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

        {/* Quick product selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hurtigvalg produkt
          </label>
          <div className="flex flex-wrap gap-2">
            {commonProducts.map((product) => (
              <button
                key={product.name}
                type="button"
                onClick={() => selectProduct(product)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  formData.productName === product.name
                    ? 'bg-honey-100 border-honey-500 text-honey-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {product.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product name */}
        <Input
          label="Produktnavn *"
          value={formData.productName}
          onChange={(e) => setFormData((prev) => ({ ...prev, productName: e.target.value }))}
          placeholder="F.eks. Oxalsyre"
          required
        />

        {/* Product type and target */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Produkttype
            </label>
            <select
              value={formData.productType}
              onChange={(e) => setFormData((prev) => ({ ...prev, productType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              {productTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Behandler
            </label>
            <select
              value={formData.target}
              onChange={(e) => setFormData((prev) => ({ ...prev, target: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              {targets.map((target) => (
                <option key={target.value} value={target.value}>{target.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dosage */}
        <Input
          label="Dosering"
          value={formData.dosage}
          onChange={(e) => setFormData((prev) => ({ ...prev, dosage: e.target.value }))}
          placeholder="F.eks. 5ml per ramme"
        />

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Startdato *
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sluttdato
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            />
          </div>
        </div>

        {/* Withholding period */}
        <Input
          label="Tilbakeholdelsestid (dager)"
          type="number"
          min="0"
          value={formData.withholdingPeriodDays.toString()}
          onChange={(e) => setFormData((prev) => ({ ...prev, withholdingPeriodDays: parseInt(e.target.value) || 0 }))}
        />

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
            {createMutation.isPending ? 'Lagrer...' : 'Lagre behandling'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
