'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productionApi, hivesApi, apiariesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Package, Plus, Calendar, Trash2, TrendingUp, Coins } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';

interface Production {
  id: string;
  hive?: { id: string; hiveNumber: string };
  apiary?: { id: string; name: string };
  harvestDate: string;
  productType: string;
  honeyType?: string;
  amountKg: number;
  qualityGrade?: string;
  moistureContent?: number;
  pricePerKg?: number;
  totalRevenue?: number;
  soldTo?: string;
  saleDate?: string;
  notes?: string;
  createdAt: string;
}

interface Hive {
  id: string;
  hiveNumber: string;
  apiary: { id: string; name: string };
}

interface Apiary {
  id: string;
  name: string;
}

const productTypes = [
  { value: 'honey', label: 'Honning' },
  { value: 'wax', label: 'Voks' },
  { value: 'propolis', label: 'Propolis' },
  { value: 'pollen', label: 'Pollen' },
  { value: 'royal_jelly', label: 'Dronninggelé' },
];

const honeyTypes = [
  { value: 'wildflower', label: 'Blomsterhonning' },
  { value: 'heather', label: 'Lynghonning' },
  { value: 'clover', label: 'Kløverhonning' },
  { value: 'rapeseed', label: 'Rapshonning' },
  { value: 'forest', label: 'Skoghonning' },
  { value: 'mixed', label: 'Blandingshonning' },
  { value: 'other', label: 'Annet' },
];

const qualityGrades = [
  { value: 'A', label: 'A - Førsteklasses' },
  { value: 'B', label: 'B - Standard' },
  { value: 'C', label: 'C - Industri' },
];

export default function ProductionPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const { data: productionResponse, isLoading } = useQuery({
    queryKey: ['production', filterYear],
    queryFn: () => productionApi.list({ year: filterYear }),
  });

  const { data: hivesResponse } = useQuery({
    queryKey: ['hives'],
    queryFn: () => hivesApi.list(),
  });

  const { data: apiariesResponse } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production'] });
    },
  });

  const production = (productionResponse?.data || []) as Production[];
  const hives = (hivesResponse?.data || []) as Hive[];
  const apiaries = (apiariesResponse?.data || []) as Apiary[];

  const totalHoneyKg = production
    .filter((p) => p.productType === 'honey')
    .reduce((sum, p) => sum + p.amountKg, 0);

  const totalWaxKg = production
    .filter((p) => p.productType === 'wax')
    .reduce((sum, p) => sum + p.amountKg, 0);

  const totalRevenue = production.reduce((sum, p) => sum + (p.totalRevenue || 0), 0);

  const getProductTypeLabel = (type: string) => {
    return productTypes.find((t) => t.value === type)?.label || type;
  };

  const getHoneyTypeLabel = (type: string) => {
    return honeyTypes.find((t) => t.value === type)?.label || type;
  };

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produksjon</h1>
          <p className="text-gray-500">Registrer og følg med på honninghøsting</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny høsting
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Honning totalt</p>
                <p className="text-2xl font-bold">{totalHoneyKg.toFixed(1)} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Package className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Voks totalt</p>
                <p className="text-2xl font-bold">{totalWaxKg.toFixed(1)} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Coins className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total inntekt</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Antall høstinger</p>
                <p className="text-2xl font-bold">{production.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Year filter */}
      <div className="flex gap-2">
        {years.map((year) => (
          <Button
            key={year}
            variant={filterYear === year.toString() ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterYear(year.toString())}
          >
            {year}
          </Button>
        ))}
      </div>

      {/* Production list */}
      <Card>
        <CardHeader>
          <CardTitle>Høstingshistorikk {filterYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Laster produksjon...</p>
          ) : production.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen høstinger registrert for {filterYear}</p>
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Registrer høsting
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {production.map((record) => (
                <div key={record.id} className="py-4 flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Package className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {getProductTypeLabel(record.productType)}
                          {record.honeyType && ` - ${getHoneyTypeLabel(record.honeyType)}`}
                        </h3>
                        <Badge variant="success">{record.amountKg} kg</Badge>
                        {record.qualityGrade && (
                          <Badge variant="secondary">Kvalitet {record.qualityGrade}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {record.hive
                          ? `Kube ${record.hive.hiveNumber}`
                          : record.apiary
                          ? record.apiary.name
                          : 'Ukjent kilde'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(record.harvestDate)}
                        </span>
                        {record.moistureContent && (
                          <span>Fuktighet: {record.moistureContent}%</span>
                        )}
                        {record.pricePerKg && (
                          <span>Pris: {formatCurrency(record.pricePerKg)}/kg</span>
                        )}
                      </div>
                      {record.totalRevenue && record.totalRevenue > 0 && (
                        <p className="text-sm text-green-600 mt-1">
                          Inntekt: {formatCurrency(record.totalRevenue)}
                          {record.soldTo && ` - Solgt til: ${record.soldTo}`}
                        </p>
                      )}
                      {record.notes && (
                        <p className="text-sm text-gray-500 mt-1">{record.notes}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Er du sikker på at du vil slette denne høstingen?')) {
                        deleteMutation.mutate(record.id);
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
      <CreateProductionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        hives={hives}
        apiaries={apiaries}
      />
    </div>
  );
}

function CreateProductionModal({
  isOpen,
  onClose,
  hives,
  apiaries,
}: {
  isOpen: boolean;
  onClose: () => void;
  hives: Hive[];
  apiaries: Apiary[];
}) {
  const queryClient = useQueryClient();
  const [sourceType, setSourceType] = useState<'hive' | 'apiary'>('hive');
  const [formData, setFormData] = useState({
    hiveId: '',
    apiaryId: '',
    harvestDate: new Date().toISOString().slice(0, 10),
    productType: 'honey',
    honeyType: 'wildflower',
    amountKg: '',
    qualityGrade: '',
    moistureContent: '',
    pricePerKg: '',
    soldTo: '',
    saleDate: '',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof productionApi.create>[0]) =>
      productionApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production'] });
      onClose();
      setFormData({
        hiveId: '',
        apiaryId: '',
        harvestDate: new Date().toISOString().slice(0, 10),
        productType: 'honey',
        honeyType: 'wildflower',
        amountKg: '',
        qualityGrade: '',
        moistureContent: '',
        pricePerKg: '',
        soldTo: '',
        saleDate: '',
        notes: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.harvestDate || !formData.amountKg) return;
    if (sourceType === 'hive' && !formData.hiveId) return;
    if (sourceType === 'apiary' && !formData.apiaryId) return;

    createMutation.mutate({
      hiveId: sourceType === 'hive' ? formData.hiveId : undefined,
      apiaryId: sourceType === 'apiary' ? formData.apiaryId : undefined,
      harvestDate: new Date(formData.harvestDate).toISOString(),
      productType: formData.productType,
      honeyType: formData.productType === 'honey' ? formData.honeyType : undefined,
      amountKg: parseFloat(formData.amountKg),
      qualityGrade: formData.qualityGrade || undefined,
      moistureContent: formData.moistureContent ? parseFloat(formData.moistureContent) : undefined,
      pricePerKg: formData.pricePerKg ? parseFloat(formData.pricePerKg) : undefined,
      soldTo: formData.soldTo || undefined,
      saleDate: formData.saleDate ? new Date(formData.saleDate).toISOString() : undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrer høsting" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source type toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Registrer for
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sourceType === 'hive' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSourceType('hive')}
            >
              Enkelt kube
            </Button>
            <Button
              type="button"
              variant={sourceType === 'apiary' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSourceType('apiary')}
            >
              Hel bigård
            </Button>
          </div>
        </div>

        {/* Hive or apiary selection */}
        {sourceType === 'hive' ? (
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
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Velg bigård *
            </label>
            <select
              value={formData.apiaryId}
              onChange={(e) => setFormData((prev) => ({ ...prev, apiaryId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
              required
            >
              <option value="">Velg bigård...</option>
              {apiaries.map((apiary) => (
                <option key={apiary.id} value={apiary.id}>
                  {apiary.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Høstingsdato *
          </label>
          <input
            type="date"
            value={formData.harvestDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, harvestDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            required
          />
        </div>

        {/* Product type and honey type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Produkttype *
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
          {formData.productType === 'honey' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Honningtype
              </label>
              <select
                value={formData.honeyType}
                onChange={(e) => setFormData((prev) => ({ ...prev, honeyType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
              >
                {honeyTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Amount and quality */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Mengde (kg) *"
            type="number"
            step="0.1"
            min="0"
            value={formData.amountKg}
            onChange={(e) => setFormData((prev) => ({ ...prev, amountKg: e.target.value }))}
            placeholder="F.eks. 15.5"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kvalitetsgrad
            </label>
            <select
              value={formData.qualityGrade}
              onChange={(e) => setFormData((prev) => ({ ...prev, qualityGrade: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            >
              <option value="">Velg kvalitet...</option>
              {qualityGrades.map((grade) => (
                <option key={grade.value} value={grade.value}>{grade.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Moisture content (for honey) */}
        {formData.productType === 'honey' && (
          <Input
            label="Fuktighetsinnhold (%)"
            type="number"
            step="0.1"
            min="0"
            max="30"
            value={formData.moistureContent}
            onChange={(e) => setFormData((prev) => ({ ...prev, moistureContent: e.target.value }))}
            placeholder="F.eks. 17.5"
          />
        )}

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Pris per kg (NOK)"
            type="number"
            step="1"
            min="0"
            value={formData.pricePerKg}
            onChange={(e) => setFormData((prev) => ({ ...prev, pricePerKg: e.target.value }))}
            placeholder="F.eks. 150"
          />
          <Input
            label="Solgt til"
            value={formData.soldTo}
            onChange={(e) => setFormData((prev) => ({ ...prev, soldTo: e.target.value }))}
            placeholder="Kundenavn"
          />
        </div>

        {/* Sale date */}
        {formData.soldTo && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salgsdato
            </label>
            <input
              type="date"
              value={formData.saleDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, saleDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            />
          </div>
        )}

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
            {createMutation.isPending ? 'Lagrer...' : 'Lagre høsting'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
