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
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { calendarApi, apiariesApi, hivesApi } from '../../lib/api';

const eventTypeOptions = [
  { value: 'visit', label: 'Bigårdbesøk' },
  { value: 'feeding', label: 'Foring' },
  { value: 'queen_breeding', label: 'Dronningavl' },
  { value: 'treatment', label: 'Behandling' },
  { value: 'harvest', label: 'Honninghøsting' },
  { value: 'meeting', label: 'Møte' },
  { value: 'other', label: 'Annet' },
];

export default function NewCalendarEventScreen() {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    eventType: 'visit',
    eventDate: new Date().toISOString().slice(0, 10),
    description: '',
    apiaryId: '',
    hiveId: '',
    notes: '',
  });

  const { data: apiariesData } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const { data: hivesData } = useQuery({
    queryKey: ['hives'],
    queryFn: () => hivesApi.list(),
  });

  const apiaries = apiariesData?.data || [];
  const allHives = (hivesData?.data || []) as Array<{
    id: string;
    hiveNumber: string;
    apiary: { id: string; name: string };
  }>;
  const filteredHives = formData.apiaryId
    ? allHives.filter((h) => h.apiary.id === formData.apiaryId)
    : allHives;

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof calendarApi.create>[0]) =>
      calendarApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      Alert.alert('Lagret', 'Hendelsen er opprettet', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      Alert.alert('Feil', 'Kunne ikke lagre hendelsen');
    },
  });

  const handleSave = () => {
    if (!formData.title.trim()) {
      Alert.alert('Mangler data', 'Tittel er påkrevd');
      return;
    }

    createMutation.mutate({
      title: formData.title.trim(),
      eventType: formData.eventType,
      eventDate: new Date(formData.eventDate).toISOString(),
      description: formData.description || undefined,
      apiaryId: formData.apiaryId || undefined,
      hiveId: formData.hiveId || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Ny hendelse</Text>

      {/* Title */}
      <View style={styles.field}>
        <Text style={styles.label}>Tittel *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, title: text }))}
          placeholder="F.eks. Besøk bigård nord"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Event type */}
      <View style={styles.field}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.optionGrid}>
          {eventTypeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionButton,
                formData.eventType === opt.value && styles.optionButtonActive,
              ]}
              onPress={() => setFormData((prev) => ({ ...prev, eventType: opt.value }))}
            >
              <Text
                style={[
                  styles.optionText,
                  formData.eventType === opt.value && styles.optionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Date */}
      <View style={styles.field}>
        <Text style={styles.label}>Dato *</Text>
        <TextInput
          style={styles.input}
          value={formData.eventDate}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, eventDate: text }))}
          placeholder="ÅÅÅÅ-MM-DD"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={styles.label}>Beskrivelse</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) =>
            setFormData((prev) => ({ ...prev, description: text }))
          }
          placeholder="Kort beskrivelse..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Apiary */}
      <View style={styles.field}>
        <Text style={styles.label}>Bigård (valgfritt)</Text>
        <View style={styles.optionGrid}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              !formData.apiaryId && styles.optionButtonActive,
            ]}
            onPress={() =>
              setFormData((prev) => ({ ...prev, apiaryId: '', hiveId: '' }))
            }
          >
            <Text
              style={[
                styles.optionText,
                !formData.apiaryId && styles.optionTextActive,
              ]}
            >
              Ingen
            </Text>
          </TouchableOpacity>
          {apiaries.map((apiary: { id: string; name: string }) => (
            <TouchableOpacity
              key={apiary.id}
              style={[
                styles.optionButton,
                formData.apiaryId === apiary.id && styles.optionButtonActive,
              ]}
              onPress={() =>
                setFormData((prev) => ({
                  ...prev,
                  apiaryId: apiary.id,
                  hiveId: '',
                }))
              }
            >
              <Text
                style={[
                  styles.optionText,
                  formData.apiaryId === apiary.id && styles.optionTextActive,
                ]}
              >
                {apiary.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Hive */}
      {filteredHives.length > 0 && (
        <View style={styles.field}>
          <Text style={styles.label}>Kube (valgfritt)</Text>
          <View style={styles.optionGrid}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                !formData.hiveId && styles.optionButtonActive,
              ]}
              onPress={() => setFormData((prev) => ({ ...prev, hiveId: '' }))}
            >
              <Text
                style={[
                  styles.optionText,
                  !formData.hiveId && styles.optionTextActive,
                ]}
              >
                Ingen
              </Text>
            </TouchableOpacity>
            {filteredHives.map((hive) => (
              <TouchableOpacity
                key={hive.id}
                style={[
                  styles.optionButton,
                  formData.hiveId === hive.id && styles.optionButtonActive,
                ]}
                onPress={() =>
                  setFormData((prev) => ({ ...prev, hiveId: hive.id }))
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    formData.hiveId === hive.id && styles.optionTextActive,
                  ]}
                >
                  {hive.hiveNumber} - {hive.apiary.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Notes */}
      <View style={styles.field}>
        <Text style={styles.label}>Notater</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
          placeholder="Tilleggsinformasjon..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, createMutation.isPending && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={createMutation.isPending}
        activeOpacity={0.7}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Lagre hendelse</Text>
          </>
        )}
      </TouchableOpacity>
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
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionButtonActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  optionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  optionTextActive: {
    color: '#92400e',
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
