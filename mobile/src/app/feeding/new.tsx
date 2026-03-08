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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { feedingsApi } from '../../lib/api';
import { VoiceInput } from '../../components/VoiceInput';
import { useNetworkStatus } from '../../hooks/useOffline';
import { createFeeding } from '../../services/offlineData';

const feedTypeOptions = [
  { value: 'sugar_syrup', label: 'Sukkerlake' },
  { value: 'sugar_paste', label: 'Sukkerpasta' },
  { value: 'honey', label: 'Honning' },
  { value: 'pollen_substitute', label: 'Pollenerstatning' },
  { value: 'other', label: 'Annet' },
];

const reasonOptions = [
  { value: 'autumn_feeding', label: 'Hostforing' },
  { value: 'spring_stimulation', label: 'Varstimulering' },
  { value: 'emergency', label: 'Nodforing' },
  { value: 'nuc_support', label: 'Avleggerstotte' },
  { value: 'other', label: 'Annet' },
];

export default function NewFeedingScreen() {
  const { hiveId, hiveNumber } = useLocalSearchParams<{ hiveId: string; hiveNumber: string }>();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    feedType: 'sugar_syrup',
    amountKg: '',
    sugarConcentration: '',
    reason: 'autumn_feeding',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof feedingsApi.create>[0]) =>
      feedingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
      Alert.alert('Lagret', 'Foringen er registrert', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      Alert.alert('Feil', 'Kunne ikke lagre foringen');
    },
  });

  const handleSave = async () => {
    if (!formData.amountKg || parseFloat(formData.amountKg) <= 0) {
      Alert.alert('Mangler data', 'Mengde er pakrevd');
      return;
    }

    const data = {
      hiveId,
      feedingDate: new Date().toISOString(),
      feedType: formData.feedType,
      amountKg: parseFloat(formData.amountKg),
      sugarConcentration: formData.sugarConcentration
        ? parseFloat(formData.sugarConcentration)
        : undefined,
      reason: formData.reason,
      notes: formData.notes || undefined,
    };

    if (isOnline) {
      createMutation.mutate(data);
    } else {
      setSaving(true);
      try {
        await createFeeding(data);
        queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
        Alert.alert('Lagret lokalt', 'Foringen synkroniseres når du er tilkoblet', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch {
        Alert.alert('Feil', 'Kunne ikke lagre foringen lokalt');
      } finally {
        setSaving(false);
      }
    }
  };

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {/* Feed type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="water-outline" size={18} color="#f59e0b" /> Fortype
        </Text>

        <View style={styles.buttonRow}>
          {feedTypeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionButton,
                formData.feedType === opt.value && styles.optionSelected,
              ]}
              onPress={() => updateField('feedType', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Fortype: ${opt.label}`}
              accessibilityState={{ selected: formData.feedType === opt.value }}
            >
              <Text
                style={[
                  styles.optionText,
                  formData.feedType === opt.value && styles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Amount */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="scale-outline" size={18} color="#f59e0b" /> Mengde
        </Text>

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mengde (kg) *</Text>
            <TextInput
              style={styles.input}
              value={formData.amountKg}
              onChangeText={(v) => updateField('amountKg', v)}
              keyboardType="decimal-pad"
              placeholder="0.0"
              accessibilityLabel="Mengde i kg"
            />
          </View>
          {(formData.feedType === 'sugar_syrup' || formData.feedType === 'sugar_paste') && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sukkerkonsentrasjon (%)</Text>
              <TextInput
                style={styles.input}
                value={formData.sugarConcentration}
                onChangeText={(v) => updateField('sugarConcentration', v)}
                keyboardType="decimal-pad"
                placeholder="60"
                accessibilityLabel="Sukkerkonsentrasjon i prosent"
              />
            </View>
          )}
        </View>
      </View>

      {/* Reason */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="help-circle-outline" size={18} color="#f59e0b" /> Arsak
        </Text>

        <View style={styles.buttonRow}>
          {reasonOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionButton,
                formData.reason === opt.value && styles.optionSelected,
              ]}
              onPress={() => updateField('reason', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Arsak: ${opt.label}`}
              accessibilityState={{ selected: formData.reason === opt.value }}
            >
              <Text
                style={[
                  styles.optionText,
                  formData.reason === opt.value && styles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notes */}
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

      {/* Offline indicator */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#92400e" />
          <Text style={styles.offlineText}>Offline — lagres lokalt</Text>
        </View>
      )}

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, (createMutation.isPending || saving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={createMutation.isPending || saving}
        accessibilityRole="button"
        accessibilityLabel="Lagre foring"
        accessibilityState={{ disabled: createMutation.isPending || saving }}
      >
        {(createMutation.isPending || saving) ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.saveButtonText}>Lagrer...</Text>
          </>
        ) : (
          <>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Lagre foring</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
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
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  offlineText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
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
});
