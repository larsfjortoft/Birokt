import { useState } from 'react';
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
import { inspectionsApi } from '../../lib/api';
import { logError } from '../../lib/sentry';
import { PhotoPicker } from '../../components/PhotoPicker';
import { PhotoPreview } from '../../components/PhotoPreview';
import { VoiceInput } from '../../components/VoiceInput';
import { useNetworkStatus } from '../../hooks/useOffline';
import { createInspection, savePhotosForInspection } from '../../services/offlineData';

const strengthOptions = [
  { value: 'strong', label: 'Sterk', color: '#dcfce7', textColor: '#166534' },
  { value: 'medium', label: 'Medium', color: '#fef3c7', textColor: '#92400e' },
  { value: 'weak', label: 'Svak', color: '#fee2e2', textColor: '#991b1b' },
];

const temperamentOptions = [
  { value: 'calm', label: 'Rolig' },
  { value: 'nervous', label: 'Nervøs' },
  { value: 'aggressive', label: 'Aggressiv' },
];

const healthObservationOptions = [
  { value: 'ok', label: 'Ok' },
  { value: 'chalkbrood', label: 'Kalkyngel' },
  { value: 'foulbrood', label: 'Yngelråte' },
  { value: 'varroa', label: 'Varroa' },
  { value: 'other', label: 'Annet' },
];

const actionOptions = [
  { value: 'needs_brood_box', label: 'Trenger yngelrom' },
  { value: 'needs_super', label: 'Trenger skattekasse' },
  { value: 'needs_split', label: 'Trenger deling' },
  { value: 'needs_food', label: 'Trenger mat' },
];

type HiveType = 'single_queen' | 'double_queen';

type ColonyFormData = {
  colonyNumber: number;
  strength: 'weak' | 'medium' | 'strong';
  temperament: 'calm' | 'nervous' | 'aggressive';
  queenSeen: boolean;
  queenLaying: boolean;
};

const createDefaultColonies = (hiveType?: string): ColonyFormData[] => {
  const colonyCount = hiveType === 'double_queen' ? 2 : 1;
  return Array.from({ length: colonyCount }, (_, index) => ({
    colonyNumber: index + 1,
    strength: 'medium',
    temperament: 'calm',
    queenSeen: false,
    queenLaying: true,
  }));
};

export default function NewInspectionScreen() {
  const { hiveId, hiveNumber, hiveType } = useLocalSearchParams<{
    hiveId: string;
    hiveNumber: string;
    hiveType?: HiveType;
  }>();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();

  const [formData, setFormData] = useState({
    colonies: createDefaultColonies(hiveType),
    healthObservations: ['ok'],
    notes: '',
  });

  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const toggleHealthObservation = (value: string) => {
    setFormData((prev) => {
      const current = prev.healthObservations;
      if (value === 'ok') {
        return { ...prev, healthObservations: current.includes('ok') ? [] : ['ok'] };
      }

      const withoutOk = current.filter((item) => item !== 'ok');
      const next = withoutOk.includes(value)
        ? withoutOk.filter((item) => item !== value)
        : [...withoutOk, value];
      return { ...prev, healthObservations: next };
    });
  };

  const closeInspection = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (hiveId) {
      router.replace({ pathname: '/hive/[id]', params: { id: hiveId } });
      return;
    }

    router.replace('/(tabs)/home');
  };

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
          [{ text: 'OK', onPress: closeInspection }]
        );
      } else {
        Alert.alert('Lagret', 'Inspeksjonen er registrert', [
          { text: 'OK', onPress: closeInspection },
        ]);
      }
    },
    onError: () => {
      Alert.alert('Feil', 'Kunne ikke lagre inspeksjonen');
    },
  });

  const handleSave = async () => {
    const observedIssues = formData.healthObservations.filter((item) => item !== 'ok');
    const healthStatus = observedIssues.length > 0 ? 'warning' : 'healthy';
    const diseases = observedIssues.filter((item) => ['chalkbrood', 'foulbrood', 'other'].includes(item));
    const pests = observedIssues.filter((item) => item === 'varroa');
    const primaryColony = formData.colonies[0] ?? createDefaultColonies(hiveType)[0];
    const colonies = formData.colonies.map((colony) => ({
      ...colony,
      needsFood: selectedActions.includes('needs_food'),
      healthStatus: healthStatus as 'healthy' | 'warning' | 'critical',
    }));

    const payload = {
      hiveId,
      inspectionDate: new Date().toISOString(),
      assessment: {
        strength: primaryColony.strength,
        temperament: primaryColony.temperament,
        queenSeen: primaryColony.queenSeen,
        queenLaying: primaryColony.queenLaying,
      },
      health: {
        status: healthStatus,
        diseases,
        pests,
      },
      actions: selectedActions.length > 0 ? selectedActions.map((a) => ({ actionType: a })) : undefined,
      colonies,
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
        weather: {},
        assessment: {
          strength: payload.assessment?.strength,
          temperament: payload.assessment?.temperament,
          queenSeen: payload.assessment?.queenSeen ?? false,
          queenLaying: payload.assessment?.queenLaying ?? false,
        },
        frames: {
          brood: 0,
          honey: 0,
          pollen: 0,
          empty: 0,
        },
        health: {
          status: payload.health?.status || 'healthy',
        },
        actions: payload.actions,
        notes: payload.notes,
        photos,
        colonies: payload.colonies,
      });
      queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
      Alert.alert('Lagret lokalt', 'Inspeksjonen og eventuelle bilder synkroniseres når du er tilkoblet.', [
        { text: 'OK', onPress: closeInspection },
      ]);
    } catch {
      Alert.alert('Feil', 'Kunne ikke lagre inspeksjonen lokalt');
    }
  };

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateColony = <K extends keyof ColonyFormData>(
    colonyNumber: number,
    field: K,
    value: ColonyFormData[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      colonies: prev.colonies.map((colony) =>
        colony.colonyNumber === colonyNumber ? { ...colony, [field]: value } : colony
      ),
    }));
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
        {hiveType === 'double_queen' && (
          <Text style={styles.hiveTypeLabel}>To dronninger</Text>
        )}
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('nb-NO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Assessment Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="sparkles-outline" size={18} color="#f59e0b" /> Bifolk
        </Text>

        {formData.colonies.map((colony, index) => (
          <View
            key={colony.colonyNumber}
            style={[styles.colonyGroup, index > 0 && styles.colonyGroupDivider]}
          >
            {formData.colonies.length > 1 && (
              <Text style={styles.colonyTitle}>Bifolk {colony.colonyNumber}</Text>
            )}

            <Text style={styles.label}>Styrke</Text>
            <View style={styles.buttonRow}>
              {strengthOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.colorButton,
                    { backgroundColor: colony.strength === opt.value ? opt.color : '#f3f4f6' },
                  ]}
                  onPress={() => updateColony(colony.colonyNumber, 'strength', opt.value as ColonyFormData['strength'])}
                  accessibilityRole="button"
                  accessibilityLabel={`Bifolk ${colony.colonyNumber} styrke: ${opt.label}`}
                  accessibilityState={{ selected: colony.strength === opt.value }}
                >
                  <Text
                    style={[
                      styles.colorButtonText,
                      { color: colony.strength === opt.value ? opt.textColor : '#6b7280' },
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
                    colony.temperament === opt.value && styles.optionSelected,
                  ]}
                  onPress={() => updateColony(colony.colonyNumber, 'temperament', opt.value as ColonyFormData['temperament'])}
                  accessibilityRole="button"
                  accessibilityLabel={`Bifolk ${colony.colonyNumber} temperament: ${opt.label}`}
                  accessibilityState={{ selected: colony.temperament === opt.value }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      colony.temperament === opt.value && styles.optionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.checkboxGrid}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => updateColony(colony.colonyNumber, 'queenSeen', !colony.queenSeen)}
                accessibilityRole="checkbox"
                accessibilityLabel={`Bifolk ${colony.colonyNumber} dronning sett`}
                accessibilityState={{ checked: colony.queenSeen }}
              >
                <Ionicons
                  name={colony.queenSeen ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={colony.queenSeen ? '#f59e0b' : '#9ca3af'}
                />
                <Text style={styles.checkboxLabel}>Dronning sett</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => updateColony(colony.colonyNumber, 'queenLaying', !colony.queenLaying)}
                accessibilityRole="checkbox"
                accessibilityLabel={`Bifolk ${colony.colonyNumber} dronning legger egg`}
                accessibilityState={{ checked: colony.queenLaying }}
              >
                <Ionicons
                  name={colony.queenLaying ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={colony.queenLaying ? '#f59e0b' : '#9ca3af'}
                />
                <Text style={styles.checkboxLabel}>Dronning legger egg</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Health Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="heart-outline" size={18} color="#f59e0b" /> Helse
        </Text>

        <Text style={styles.label}>Observert</Text>
        <View style={styles.buttonRow}>
          {healthObservationOptions.map((opt) => {
            const isSelected = formData.healthObservations.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionSelected,
                ]}
                onPress={() => toggleHealthObservation(opt.value)}
                accessibilityRole="checkbox"
                accessibilityLabel={`Helse observert: ${opt.label}`}
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
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={closeInspection}
        disabled={createMutation.isPending || isUploadingPhotos}
        accessibilityRole="button"
        accessibilityLabel="Avbryt inspeksjon"
        accessibilityState={{ disabled: createMutation.isPending || isUploadingPhotos }}
      >
        <Text style={styles.cancelButtonText}>Avbryt</Text>
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
  hiveTypeLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
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
  colonyGroup: {
    paddingTop: 12,
  },
  colonyGroupDivider: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 16,
  },
  colonyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
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
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
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
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#374151',
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
