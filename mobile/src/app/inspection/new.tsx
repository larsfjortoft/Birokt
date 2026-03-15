import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { inspectionsApi, weatherApi, WeatherData } from '../../lib/api';
import { logError } from '../../lib/sentry';
import { PhotoPicker } from '../../components/PhotoPicker';
import { PhotoPreview } from '../../components/PhotoPreview';
import { VoiceInput } from '../../components/VoiceInput';
import { useNetworkStatus } from '../../hooks/useOffline';
import { createInspection, savePhotosForInspection } from '../../services/offlineData';

const weatherOptions = [
  { value: 'sunny', label: 'Sol', icon: 'sunny-outline' },
  { value: 'partly_cloudy', label: 'Delvis skyet', icon: 'partly-sunny-outline' },
  { value: 'cloudy', label: 'Overskyet', icon: 'cloud-outline' },
  { value: 'rainy', label: 'Regn', icon: 'rainy-outline' },
];

const strengthOptions = [
  { value: 'strong', label: 'Sterk', color: '#dcfce7', textColor: '#166534' },
  { value: 'medium', label: 'Medium', color: '#fef3c7', textColor: '#92400e' },
  { value: 'weak', label: 'Svak', color: '#fee2e2', textColor: '#991b1b' },
];

const temperamentOptions = [
  { value: 'calm', label: 'Rolig' },
  { value: 'nervous', label: 'Nervos' },
  { value: 'aggressive', label: 'Aggressiv' },
];

const healthOptions = [
  { value: 'healthy', label: 'Frisk', color: '#dcfce7', textColor: '#166534' },
  { value: 'warning', label: 'Advarsel', color: '#fef3c7', textColor: '#92400e' },
  { value: 'critical', label: 'Kritisk', color: '#fee2e2', textColor: '#991b1b' },
];

const varroaOptions = [
  { value: 'none', label: 'Ingen' },
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Hoy' },
];

const actionOptions = [
  { value: 'swarm_tendency', label: 'Svermetrang' },
  { value: 'hunger', label: 'Sult' },
  { value: 'space_shortage', label: 'Plassmangel' },
];

export default function NewInspectionScreen() {
  const { hiveId, hiveNumber, apiaryLat, apiaryLng } = useLocalSearchParams<{
    hiveId: string;
    hiveNumber: string;
    apiaryLat?: string;
    apiaryLng?: string;
  }>();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();

  const [formData, setFormData] = useState({
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
    varroaLevel: 'none',
    notes: '',
  });

  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherSource, setWeatherSource] = useState<'auto' | 'manual'>('auto');

  // Fetch weather data automatically on mount
  // Priority: 1) Apiary coordinates (from database), 2) GPS location
  useEffect(() => {
    async function fetchWeather() {
      try {
        setWeatherLoading(true);
        setWeatherError(null);

        let lat: number | undefined;
        let lng: number | undefined;

        // Use apiary coordinates if available
        if (apiaryLat && apiaryLng) {
          lat = parseFloat(apiaryLat);
          lng = parseFloat(apiaryLng);
        }

        // Fall back to GPS if no apiary coordinates
        if (!lat || !lng) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setWeatherError('Mangler tilgang til lokasjon');
            setWeatherSource('manual');
            setWeatherLoading(false);
            return;
          }

          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = location.coords.latitude;
          lng = location.coords.longitude;
        }

        // Fetch weather from API
        if (!isOnline) {
          setWeatherError('Ingen nettforbindelse');
          setWeatherSource('manual');
          setWeatherLoading(false);
          return;
        }

        const response = await weatherApi.current(lat, lng);

        if (response.data) {
          const weather = response.data;
          setFormData((prev) => ({
            ...prev,
            temperature: weather.temperature.toString(),
            windSpeed: weather.windSpeed.toString(),
            weatherCondition: mapConditionCode(weather.conditionCode),
          }));
          setWeatherSource('auto');
        }
      } catch (error) {
        logError(error, { context: 'fetchWeather' });
        setWeatherError('Kunne ikke hente værdata');
        setWeatherSource('manual');
      } finally {
        setWeatherLoading(false);
      }
    }

    fetchWeather();
  }, [apiaryLat, apiaryLng, isOnline]);

  // Map met.no condition codes to our form options
  function mapConditionCode(code: string): string {
    const mapping: Record<string, string> = {
      sunny: 'sunny',
      partly_cloudy: 'partly_cloudy',
      cloudy: 'cloudy',
      rainy: 'rainy',
      snowy: 'cloudy',
      foggy: 'cloudy',
      stormy: 'rainy',
    };
    return mapping[code] || 'cloudy';
  }

  const createMutation = useMutation({
    mutationFn: async (data: Parameters<typeof inspectionsApi.create>[0]) => {
      const result = await inspectionsApi.create(data);
      let photosFailed = false;

      if (photos.length > 0 && result.data?.id) {
        setIsUploadingPhotos(true);
        try {
          await inspectionsApi.uploadPhotos(result.data.id, data.hiveId, photos);
        } catch (photoError) {
          logError(photoError, { context: 'uploadPhotos' });
          await savePhotosForInspection(result.data.id, data.hiveId, photos);
          photosFailed = true;
        } finally {
          setIsUploadingPhotos(false);
        }
      }

      return { result, photosFailed };
    },
    onSuccess: ({ photosFailed }) => {
      queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
      if (photosFailed) {
        Alert.alert(
          'Delvis lagret',
          'Inspeksjonen ble lagret, men bildene kunne ikke lastes opp. Bildeopplasting er ikke støttet på serveren ennå.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Lagret', 'Inspeksjonen er registrert', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    },
    onError: () => {
      Alert.alert('Feil', 'Kunne ikke lagre inspeksjonen');
    },
  });

  const handleSave = async () => {
    const payload = {
      hiveId,
      inspectionDate: new Date().toISOString(),
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
      },
      actions: selectedActions.length > 0 ? selectedActions.map((a) => ({ actionType: a })) : undefined,
      notes: formData.notes || undefined,
    };

    if (isOnline) {
      createMutation.mutate(payload);
      return;
    }

    try {
      await createInspection({
        hiveId: payload.hiveId,
        inspectionDate: payload.inspectionDate,
        weather: payload.weather || {},
        assessment: {
          strength: payload.assessment?.strength,
          temperament: payload.assessment?.temperament,
          queenSeen: payload.assessment?.queenSeen ?? false,
          queenLaying: payload.assessment?.queenLaying ?? false,
        },
        frames: {
          brood: payload.frames?.brood ?? 0,
          honey: payload.frames?.honey ?? 0,
          pollen: payload.frames?.pollen ?? 0,
          empty: payload.frames?.empty ?? 0,
        },
        health: {
          status: payload.health?.status || 'healthy',
          varroaLevel: payload.health?.varroaLevel,
        },
        notes: payload.notes,
        photos,
      });
      queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
      Alert.alert('Lagret lokalt', 'Inspeksjonen og eventuelle bilder synkroniseres når du er tilkoblet.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Feil', 'Kunne ikke lagre inspeksjonen lokalt');
    }
  };

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#92400e" />
            <Text style={styles.offlineText}>Offline - inspeksjonen lagres lokalt</Text>
          </View>
        )}
        <View style={styles.header}>
        <Text style={styles.headerTitle}>Kube {hiveNumber}</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('nb-NO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Weather Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="thermometer-outline" size={18} color="#f59e0b" /> Vær
          </Text>
          {weatherLoading ? (
            <View style={styles.weatherStatus}>
              <ActivityIndicator size="small" color="#f59e0b" />
              <Text style={styles.weatherStatusText}>Henter fra YR...</Text>
            </View>
          ) : weatherSource === 'auto' ? (
            <View style={styles.weatherStatus}>
              <Ionicons name="location" size={14} color="#10b981" />
              <Text style={[styles.weatherStatusText, { color: '#10b981' }]}>Fra YR.no</Text>
            </View>
          ) : weatherError ? (
            <View style={styles.weatherStatus}>
              <Ionicons name="alert-circle" size={14} color="#f59e0b" />
              <Text style={[styles.weatherStatusText, { color: '#f59e0b' }]}>Manuelt</Text>
            </View>
          ) : null}
        </View>

        {weatherError && (
          <View style={styles.weatherErrorBanner}>
            <Ionicons name="information-circle" size={16} color="#92400e" />
            <Text style={styles.weatherErrorText}>{weatherError}. Fyll inn manuelt.</Text>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Temperatur (C)</Text>
            <TextInput
              style={[styles.input, weatherSource === 'auto' && styles.inputAuto]}
              value={formData.temperature}
              onChangeText={(v) => {
                updateField('temperature', v);
                setWeatherSource('manual');
              }}
              keyboardType="numeric"
              placeholder="18"
              accessibilityLabel="Temperatur i celsius"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vind (m/s)</Text>
            <TextInput
              style={[styles.input, weatherSource === 'auto' && styles.inputAuto]}
              value={formData.windSpeed}
              onChangeText={(v) => {
                updateField('windSpeed', v);
                setWeatherSource('manual');
              }}
              keyboardType="numeric"
              placeholder="3"
              accessibilityLabel="Vindstyrke i meter per sekund"
            />
          </View>
        </View>

        <Text style={styles.label}>Værforhold</Text>
        <View style={styles.buttonRow}>
          {weatherOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionButton,
                formData.weatherCondition === opt.value && styles.optionSelected,
              ]}
              onPress={() => {
                updateField('weatherCondition', opt.value);
                setWeatherSource('manual');
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: formData.weatherCondition === opt.value }}
            >
              <Ionicons
                name={opt.icon as 'sunny-outline'}
                size={20}
                color={formData.weatherCondition === opt.value ? '#f59e0b' : '#6b7280'}
              />
              <Text
                style={[
                  styles.optionText,
                  formData.weatherCondition === opt.value && styles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Assessment Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="sparkles-outline" size={18} color="#f59e0b" /> Vurdering
        </Text>

        <Text style={styles.label}>Kolonistyrke</Text>
        <View style={styles.buttonRow}>
          {strengthOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.colorButton,
                { backgroundColor: formData.strength === opt.value ? opt.color : '#f3f4f6' },
              ]}
              onPress={() => updateField('strength', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Kolonistyrke: ${opt.label}`}
              accessibilityState={{ selected: formData.strength === opt.value }}
            >
              <Text
                style={[
                  styles.colorButtonText,
                  { color: formData.strength === opt.value ? opt.textColor : '#6b7280' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Temperament</Text>
        <View style={styles.buttonRow}>
          {temperamentOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionButton,
                formData.temperament === opt.value && styles.optionSelected,
              ]}
              onPress={() => updateField('temperament', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Temperament: ${opt.label}`}
              accessibilityState={{ selected: formData.temperament === opt.value }}
            >
              <Text
                style={[
                  styles.optionText,
                  formData.temperament === opt.value && styles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.checkboxRow}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => updateField('queenSeen', !formData.queenSeen)}
            accessibilityRole="checkbox"
            accessibilityLabel="Dronning sett"
            accessibilityState={{ checked: formData.queenSeen }}
          >
            <Ionicons
              name={formData.queenSeen ? 'checkbox' : 'square-outline'}
              size={24}
              color={formData.queenSeen ? '#f59e0b' : '#9ca3af'}
            />
            <Text style={styles.checkboxLabel}>Dronning sett</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => updateField('queenLaying', !formData.queenLaying)}
            accessibilityRole="checkbox"
            accessibilityLabel="Legger egg"
            accessibilityState={{ checked: formData.queenLaying }}
          >
            <Ionicons
              name={formData.queenLaying ? 'checkbox' : 'square-outline'}
              size={24}
              color={formData.queenLaying ? '#f59e0b' : '#9ca3af'}
            />
            <Text style={styles.checkboxLabel}>Legger egg</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Frames Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="layers-outline" size={18} color="#f59e0b" /> Rammer
        </Text>

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Yngel</Text>
            <TextInput
              style={styles.input}
              value={formData.broodFrames}
              onChangeText={(v) => updateField('broodFrames', v)}
              keyboardType="numeric"
              placeholder="0"
              accessibilityLabel="Antall yngelrammer"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Honning</Text>
            <TextInput
              style={styles.input}
              value={formData.honeyFrames}
              onChangeText={(v) => updateField('honeyFrames', v)}
              keyboardType="numeric"
              placeholder="0"
              accessibilityLabel="Antall honningrammer"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pollen</Text>
            <TextInput
              style={styles.input}
              value={formData.pollenFrames}
              onChangeText={(v) => updateField('pollenFrames', v)}
              keyboardType="numeric"
              placeholder="0"
              accessibilityLabel="Antall pollenrammer"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tomme</Text>
            <TextInput
              style={styles.input}
              value={formData.emptyFrames}
              onChangeText={(v) => updateField('emptyFrames', v)}
              keyboardType="numeric"
              placeholder="0"
              accessibilityLabel="Antall tomme rammer"
            />
          </View>
        </View>
      </View>

      {/* Health Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="heart-outline" size={18} color="#f59e0b" /> Helse
        </Text>

        <Text style={styles.label}>Helsestatus</Text>
        <View style={styles.buttonRow}>
          {healthOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.colorButton,
                { backgroundColor: formData.healthStatus === opt.value ? opt.color : '#f3f4f6' },
              ]}
              onPress={() => updateField('healthStatus', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Helsestatus: ${opt.label}`}
              accessibilityState={{ selected: formData.healthStatus === opt.value }}
            >
              <Text
                style={[
                  styles.colorButtonText,
                  { color: formData.healthStatus === opt.value ? opt.textColor : '#6b7280' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Varroatrykk</Text>
        <View style={styles.buttonRow}>
          {varroaOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionButton,
                formData.varroaLevel === opt.value && styles.optionSelected,
              ]}
              onPress={() => updateField('varroaLevel', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Varroatrykk: ${opt.label}`}
              accessibilityState={{ selected: formData.varroaLevel === opt.value }}
            >
              <Text
                style={[
                  styles.optionText,
                  formData.varroaLevel === opt.value && styles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="hand-left-outline" size={18} color="#f59e0b" /> Handling
        </Text>
        <View style={styles.buttonRow}>
          {actionOptions.map((opt) => {
            const isSelected = selectedActions.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionButton,
                  isSelected && { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#f59e0b' },
                ]}
                onPress={() => {
                  setSelectedActions((prev) =>
                    isSelected ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]
                  );
                }}
                accessibilityRole="checkbox"
                accessibilityLabel={`Handling: ${opt.label}`}
                accessibilityState={{ checked: isSelected }}
              >
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={isSelected ? '#f59e0b' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.optionText,
                    isSelected && { color: '#92400e', fontWeight: '500' },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Photos Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="camera-outline" size={18} color="#f59e0b" /> Bilder
        </Text>
        <PhotoPicker photos={photos} onPhotosChange={setPhotos} />
        <PhotoPreview
          photos={photos}
          onRemove={(index) => {
            setPhotos((prev) => prev.filter((_, i) => i !== index));
          }}
        />
      </View>

      {/* Notes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text-outline" size={18} color="#f59e0b" /> Notater
          </Text>
          <VoiceInput
            onTranscript={(text) =>
              updateField('notes', formData.notes ? formData.notes + ' ' + text : text)
            }
          />
        </View>
        <TextInput
          style={styles.textArea}
          value={formData.notes}
          onChangeText={(v) => updateField('notes', v)}
          placeholder="Legg til observasjoner..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          accessibilityLabel="Notater"
        />
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, (createMutation.isPending || isUploadingPhotos) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={createMutation.isPending || isUploadingPhotos}
        accessibilityRole="button"
        accessibilityLabel="Lagre inspeksjon"
        accessibilityState={{ disabled: createMutation.isPending || isUploadingPhotos }}
      >
        {createMutation.isPending || isUploadingPhotos ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.saveButtonText}>
              {isUploadingPhotos ? 'Laster opp bilder...' : 'Lagrer...'}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Lagre inspeksjon</Text>
          </>
        )}
      </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  weatherStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherStatusText: {
    fontSize: 12,
    color: '#6b7280',
  },
  weatherErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  weatherErrorText: {
    fontSize: 12,
    color: '#92400e',
    flex: 1,
  },
  inputAuto: {
    borderWidth: 1,
    borderColor: '#10b981',
    borderStyle: 'dashed',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    minHeight: 100,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  optionSelected: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  optionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  optionTextSelected: {
    color: '#92400e',
    fontWeight: '500',
  },
  colorButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  colorButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 4,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 32,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  offlineText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
  },
});
