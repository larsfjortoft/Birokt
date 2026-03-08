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
import { productionApi } from '../../lib/api';
import { useNetworkStatus } from '../../hooks/useOffline';
import { createProduction } from '../../services/offlineData';

const productTypeOptions = [
  { value: 'honey', label: 'Honning' },
  { value: 'wax', label: 'Voks' },
  { value: 'propolis', label: 'Propolis' },
  { value: 'pollen', label: 'Pollen' },
  { value: 'other', label: 'Annet' },
];

const honeyTypeOptions = [
  { value: 'wildflower', label: 'Blomsterhonning' },
  { value: 'heather', label: 'Lynghonning' },
  { value: 'clover', label: 'Kloverhonning' },
  { value: 'rapeseed', label: 'Rapshonning' },
  { value: 'forest', label: 'Skoghonning' },
  { value: 'other', label: 'Annen' },
];

const qualityOptions = [
  { value: 'premium', label: 'Premium', color: '#dcfce7', textColor: '#166534' },
  { value: 'standard', label: 'Standard', color: '#fef3c7', textColor: '#92400e' },
  { value: 'processing', label: 'Industri', color: '#fee2e2', textColor: '#991b1b' },
];

export default function NewProductionScreen() {
  const { hiveId, hiveNumber } = useLocalSearchParams<{ hiveId: string; hiveNumber: string }>();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    productType: 'honey',
    honeyType: 'wildflower',
    amountKg: '',
    qualityGrade: 'standard',
    moistureContent: '',
    pricePerKg: '',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof productionApi.create>[0]) =>
      productionApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      Alert.alert('Lagret', 'Produksjonen er registrert', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      Alert.alert('Feil', 'Kunne ikke lagre produksjonen');
    },
  });

  const handleSave = async () => {
    if (!formData.amountKg || parseFloat(formData.amountKg) <= 0) {
      Alert.alert('Mangler data', 'Mengde er pakrevd');
      return;
    }

    const data = {
      hiveId: hiveId || undefined,
      harvestDate: new Date().toISOString(),
      productType: formData.productType,
      honeyType: formData.productType === 'honey' ? formData.honeyType : undefined,
      amountKg: parseFloat(formData.amountKg),
      qualityGrade: formData.qualityGrade,
      moistureContent: formData.moistureContent
        ? parseFloat(formData.moistureContent)
        : undefined,
      pricePerKg: formData.pricePerKg
        ? parseFloat(formData.pricePerKg)
        : undefined,
      notes: formData.notes || undefined,
    };

    if (isOnline) {
      createMutation.mutate(data);
    } else {
      setSaving(true);
      try {
        await createProduction(data);
        queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        Alert.alert('Lagret lokalt', 'Produksjonen synkroniseres når du er tilkoblet', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch {
        Alert.alert('Feil', 'Kunne ikke lagre produksjonen lokalt');
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
        <Text style={styles.headerTitle}>
          {hiveNumber ? `Kube ${hiveNumber}` : 'Ny produksjon'}
        </Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('nb-NO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Product type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="flask-outline" size={18} color="#f59e0b" /> Produkttype
        </Text>

        <View style={styles.buttonRow}>
          {productTypeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionButton,
                formData.productType === opt.value && styles.optionSelected,
              ]}
              onPress={() => updateField('productType', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Produkttype: ${opt.label}`}
              accessibilityState={{ selected: formData.productType === opt.value }}
            >
              <Text
                style={[
                  styles.optionText,
                  formData.productType === opt.value && styles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {formData.productType === 'honey' && (
          <>
            <Text style={styles.label}>Honningtype</Text>
            <View style={styles.buttonRow}>
              {honeyTypeOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionButton,
                    formData.honeyType === opt.value && styles.optionSelected,
                  ]}
                  onPress={() => updateField('honeyType', opt.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Honningtype: ${opt.label}`}
                  accessibilityState={{ selected: formData.honeyType === opt.value }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      formData.honeyType === opt.value && styles.optionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Amount and quality */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="scale-outline" size={18} color="#f59e0b" /> Mengde og kvalitet
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
          {formData.productType === 'honey' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fuktighet (%)</Text>
              <TextInput
                style={styles.input}
                value={formData.moistureContent}
                onChangeText={(v) => updateField('moistureContent', v)}
                keyboardType="decimal-pad"
                placeholder="18.0"
                accessibilityLabel="Fuktighetsinnhold i prosent"
              />
            </View>
          )}
        </View>

        <Text style={styles.label}>Kvalitet</Text>
        <View style={styles.buttonRow}>
          {qualityOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.colorButton,
                { backgroundColor: formData.qualityGrade === opt.value ? opt.color : '#f3f4f6' },
              ]}
              onPress={() => updateField('qualityGrade', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Kvalitet: ${opt.label}`}
              accessibilityState={{ selected: formData.qualityGrade === opt.value }}
            >
              <Text
                style={[
                  styles.colorButtonText,
                  { color: formData.qualityGrade === opt.value ? opt.textColor : '#6b7280' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Pricing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="cash-outline" size={18} color="#f59e0b" /> Okonomi
        </Text>

        <Text style={styles.label}>Pris per kg (NOK)</Text>
        <TextInput
          style={styles.input}
          value={formData.pricePerKg}
          onChangeText={(v) => updateField('pricePerKg', v)}
          keyboardType="decimal-pad"
          placeholder="150"
          accessibilityLabel="Pris per kg i NOK"
        />
        {formData.pricePerKg && formData.amountKg ? (
          <Text style={styles.revenueInfo}>
            Estimert inntekt:{' '}
            {(parseFloat(formData.pricePerKg) * parseFloat(formData.amountKg)).toFixed(0)} NOK
          </Text>
        ) : null}
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="document-text-outline" size={18} color="#f59e0b" /> Notater
        </Text>
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
        accessibilityLabel="Lagre produksjon"
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
            <Text style={styles.saveButtonText}>Lagre produksjon</Text>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
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
  revenueInfo: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '500',
    marginTop: -4,
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
