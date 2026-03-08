'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inspectionsApi, photosApi, weatherApi, WeatherData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Cloud,
  Sun,
  CloudRain,
  Wind,
  Thermometer,
  Crown,
  Heart,
  Layers,
  AlertTriangle,
  Camera,
  X,
  Upload,
} from 'lucide-react';

interface InspectionFormProps {
  hiveId: string;
  hiveNumber: string;
  apiaryLocation?: { lat?: number; lng?: number };
  onSuccess: () => void;
  onCancel: () => void;
}

function mapConditionCode(conditionCode: string): string {
  if (conditionCode.includes('rain') || conditionCode.includes('sleet') || conditionCode.includes('snow')) return 'rainy';
  if (conditionCode.includes('cloud') || conditionCode.includes('fog')) {
    if (conditionCode.includes('partly')) return 'partly_cloudy';
    return 'cloudy';
  }
  if (conditionCode.includes('fair') || conditionCode.includes('clear')) return 'sunny';
  return 'partly_cloudy';
}

const weatherConditions = [
  { value: 'sunny', label: 'Sol', icon: Sun },
  { value: 'partly_cloudy', label: 'Delvis skyet', icon: Cloud },
  { value: 'cloudy', label: 'Overskyet', icon: Cloud },
  { value: 'rainy', label: 'Regn', icon: CloudRain },
  { value: 'windy', label: 'Vind', icon: Wind },
];

const strengthOptions = [
  { value: 'strong', label: 'Sterk', color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'weak', label: 'Svak', color: 'bg-red-100 text-red-800 border-red-300' },
];

const temperamentOptions = [
  { value: 'calm', label: 'Rolig' },
  { value: 'nervous', label: 'Nervøs' },
  { value: 'aggressive', label: 'Aggressiv' },
];

const healthOptions = [
  { value: 'healthy', label: 'Frisk', color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'warning', label: 'Advarsel', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'critical', label: 'Kritisk', color: 'bg-red-100 text-red-800 border-red-300' },
];

const varroaLevels = [
  { value: 'none', label: 'Ingen' },
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
];

const commonDiseases = [
  'nosema',
  'foulbrood',
  'chalkbrood',
  'sacbrood',
];

const commonPests = [
  'varroa',
  'wax_moth',
  'small_hive_beetle',
  'mice',
];

interface PhotoPreview {
  id: string;
  file: File;
  preview: string;
}

export function InspectionForm({ hiveId, hiveNumber, apiaryLocation, onSuccess, onCancel }: InspectionFormProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [weatherSource, setWeatherSource] = useState<'auto' | 'manual'>('manual');
  const weatherPopulated = useRef(false);

  const hasLocation = !!(apiaryLocation?.lat && apiaryLocation?.lng);

  const { data: weatherResponse } = useQuery({
    queryKey: ['weather', 'current', apiaryLocation?.lat, apiaryLocation?.lng],
    queryFn: () => weatherApi.current(apiaryLocation!.lat!, apiaryLocation!.lng!),
    enabled: hasLocation,
    staleTime: 10 * 60 * 1000,
  });

  const [formData, setFormData] = useState({
    inspectionDate: new Date().toISOString().slice(0, 16),
    temperature: '',
    windSpeed: '',
    weatherCondition: 'sunny',
    strength: 'medium',
    temperament: 'calm',
    queenSeen: false,
    queenLaying: true,
    broodFrames: '',
    honeyFrames: '',
    pollenFrames: '',
    emptyFrames: '',
    healthStatus: 'healthy',
    varroaLevel: 'low',
    diseases: [] as string[],
    pests: [] as string[],
    notes: '',
  });

  useEffect(() => {
    if (weatherResponse?.data && !weatherPopulated.current) {
      weatherPopulated.current = true;
      const w = weatherResponse.data;
      setFormData((prev) => ({
        ...prev,
        temperature: w.temperature.toFixed(1),
        windSpeed: w.windSpeed.toFixed(1),
        weatherCondition: mapConditionCode(w.conditionCode),
      }));
      setWeatherSource('auto');
    }
  }, [weatherResponse]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof inspectionsApi.create>[0]) =>
      inspectionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      onSuccess();
    },
  });

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (['temperature', 'windSpeed', 'weatherCondition'].includes(field)) {
      setWeatherSource('manual');
    }
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleArrayItem = (field: 'diseases' | 'pests', item: string) => {
    setFormData((prev) => {
      const current = prev[field];
      const updated = current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item];
      return { ...prev, [field]: updated };
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: PhotoPreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newPhotos.push({
          id: `${Date.now()}-${i}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files) return;

    const newPhotos: PhotoPreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newPhotos.push({
          id: `${Date.now()}-${i}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.inspectionDate) {
      newErrors.inspectionDate = 'Dato er påkrevd';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Upload photos first if any
    let uploadedPhotoIds: string[] = [];
    if (photos.length > 0) {
      setIsUploadingPhotos(true);
      try {
        const formDataPhotos = new FormData();
        formDataPhotos.append('hiveId', hiveId);
        photos.forEach((photo) => {
          formDataPhotos.append('files', photo.file);
        });

        const response = await photosApi.upload(formDataPhotos);
        if (response.data) {
          uploadedPhotoIds = response.data.map((p) => p.id);
        }
      } catch (error) {
        console.error('Failed to upload photos:', error);
      } finally {
        setIsUploadingPhotos(false);
      }
    }

    createMutation.mutate({
      hiveId,
      inspectionDate: new Date(formData.inspectionDate).toISOString(),
      weather: {
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        windSpeed: formData.windSpeed ? parseFloat(formData.windSpeed) : undefined,
        condition: formData.weatherCondition,
      },
      assessment: {
        strength: formData.strength,
        temperament: formData.temperament,
        queenSeen: formData.queenSeen,
        queenLaying: formData.queenLaying,
      },
      frames: {
        brood: formData.broodFrames ? parseInt(formData.broodFrames) : undefined,
        honey: formData.honeyFrames ? parseInt(formData.honeyFrames) : undefined,
        pollen: formData.pollenFrames ? parseInt(formData.pollenFrames) : undefined,
        empty: formData.emptyFrames ? parseInt(formData.emptyFrames) : undefined,
      },
      health: {
        status: formData.healthStatus,
        varroaLevel: formData.varroaLevel,
        diseases: formData.diseases,
        pests: formData.pests,
      },
      notes: formData.notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Date and Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Inspeksjonsdato *
        </label>
        <input
          type="datetime-local"
          value={formData.inspectionDate}
          onChange={(e) => handleChange('inspectionDate', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
        />
        {errors.inspectionDate && (
          <p className="mt-1 text-sm text-red-500">{errors.inspectionDate}</p>
        )}
      </div>

      {/* Weather Section */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-honey-500" />
            Vær
          </h3>
          {weatherSource === 'auto' ? (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              Fra YR.no
            </span>
          ) : hasLocation ? (
            <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
              Manuelt
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Temperatur (°C)"
            type="number"
            step="0.1"
            value={formData.temperature}
            onChange={(e) => handleChange('temperature', e.target.value)}
            placeholder="18.5"
          />
          <Input
            label="Vindstyrke (m/s)"
            type="number"
            step="0.1"
            value={formData.windSpeed}
            onChange={(e) => handleChange('windSpeed', e.target.value)}
            placeholder="3.2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Værforhold
          </label>
          <div className="flex flex-wrap gap-2">
            {weatherConditions.map((condition) => {
              const Icon = condition.icon;
              const isSelected = formData.weatherCondition === condition.value;
              return (
                <button
                  key={condition.value}
                  type="button"
                  onClick={() => handleChange('weatherCondition', condition.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-honey-100 border-honey-500 text-honey-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{condition.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Assessment Section */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Crown className="w-4 h-4 text-honey-500" />
          Vurdering
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kolonistyrke
          </label>
          <div className="flex gap-2">
            {strengthOptions.map((option) => {
              const isSelected = formData.strength === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('strength', option.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors ${
                    isSelected ? option.color : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Temperament
          </label>
          <div className="flex gap-2">
            {temperamentOptions.map((option) => {
              const isSelected = formData.temperament === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('temperament', option.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-honey-100 border-honey-500 text-honey-700'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.queenSeen}
              onChange={(e) => handleChange('queenSeen', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-honey-500 focus:ring-honey-500"
            />
            <span className="text-sm text-gray-700">Dronning sett</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.queenLaying}
              onChange={(e) => handleChange('queenLaying', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-honey-500 focus:ring-honey-500"
            />
            <span className="text-sm text-gray-700">Dronning legger egg</span>
          </label>
        </div>
      </div>

      {/* Frames Section */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-honey-500" />
          Rammer
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input
            label="Yngelrammer"
            type="number"
            min="0"
            max="20"
            value={formData.broodFrames}
            onChange={(e) => handleChange('broodFrames', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Honningrammer"
            type="number"
            min="0"
            max="20"
            value={formData.honeyFrames}
            onChange={(e) => handleChange('honeyFrames', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Pollenrammer"
            type="number"
            min="0"
            max="20"
            value={formData.pollenFrames}
            onChange={(e) => handleChange('pollenFrames', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Tomme rammer"
            type="number"
            min="0"
            max="20"
            value={formData.emptyFrames}
            onChange={(e) => handleChange('emptyFrames', e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Health Section */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Heart className="w-4 h-4 text-honey-500" />
          Helse
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Helsestatus
          </label>
          <div className="flex gap-2">
            {healthOptions.map((option) => {
              const isSelected = formData.healthStatus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('healthStatus', option.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors ${
                    isSelected ? option.color : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Varroatrykk
          </label>
          <div className="flex gap-2">
            {varroaLevels.map((level) => {
              const isSelected = formData.varroaLevel === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => handleChange('varroaLevel', level.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-honey-100 border-honey-500 text-honey-700'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <AlertTriangle className="w-4 h-4 inline mr-1 text-yellow-500" />
              Sykdommer observert
            </label>
            <div className="flex flex-wrap gap-2">
              {commonDiseases.map((disease) => {
                const isSelected = formData.diseases.includes(disease);
                const labels: Record<string, string> = {
                  nosema: 'Nosema',
                  foulbrood: 'Lukket yngelråte',
                  chalkbrood: 'Kalkyngel',
                  sacbrood: 'Sekkyngel',
                };
                return (
                  <button
                    key={disease}
                    type="button"
                    onClick={() => toggleArrayItem('diseases', disease)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? 'bg-red-100 border-red-300 text-red-700'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {labels[disease] || disease}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <AlertTriangle className="w-4 h-4 inline mr-1 text-yellow-500" />
              Skadedyr observert
            </label>
            <div className="flex flex-wrap gap-2">
              {commonPests.map((pest) => {
                const isSelected = formData.pests.includes(pest);
                const labels: Record<string, string> = {
                  varroa: 'Varroa',
                  wax_moth: 'Voksmøll',
                  small_hive_beetle: 'Kubebille',
                  mice: 'Mus',
                };
                return (
                  <button
                    key={pest}
                    type="button"
                    onClick={() => toggleArrayItem('pests', pest)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? 'bg-red-100 border-red-300 text-red-700'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {labels[pest] || pest}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notater
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500 resize-none"
          placeholder="Legg til observasjoner, kommentarer eller planlagte tiltak..."
        />
      </div>

      {/* Photo Upload */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Camera className="w-4 h-4 text-honey-500" />
          Bilder
        </h3>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoSelect}
          className="hidden"
        />

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-honey-400 transition-colors"
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            Klikk for å velge bilder eller dra og slipp her
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PNG, JPG opptil 10MB
          </p>
        </div>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.preview}
                  alt="Preview"
                  className="w-full h-24 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(photo.id);
                  }}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {createMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Kunne ikke lagre inspeksjon. Prøv igjen.
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" disabled={createMutation.isPending || isUploadingPhotos}>
          {isUploadingPhotos
            ? 'Laster opp bilder...'
            : createMutation.isPending
            ? 'Lagrer...'
            : 'Lagre inspeksjon'}
        </Button>
      </div>
    </form>
  );
}
