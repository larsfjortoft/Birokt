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
import { treatmentsApi } from '../../lib/api';
import { VoiceInput } from '../../components/VoiceInput';
import { useNetworkStatus } from '../../hooks/useOffline';
import { createTreatment, queueComplianceDocument } from '../../services/offlineData';
import { PhotoPicker } from '../../components/PhotoPicker';

const productTypeOptions = [
  { value: 'organic_acid', label: 'Organisk syre' },
  { value: 'essential_oil', label: 'Eterisk olje' },
  { value: 'synthetic', label: 'Syntetisk' },
  { value: 'biological', label: 'Biologisk' },
  { value: 'other', label: 'Annet' },
];

const targetOptions = [
  { value: 'varroa', label: 'Varroa' },
  { value: 'nosema', label: 'Nosema' },
  { value: 'foulbrood', label: 'Bipest' },
  { value: 'wax_moth', label: 'Voksmott' },
  { value: 'other', label: 'Annet' },
];

export default function NewTreatmentScreen() {
  const { hiveId, hiveNumber } = useLocalSearchParams<{ hiveId: string; hiveNumber: string }>();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  const [saving, setSaving] = useState(false);
  const [documents,setDocuments]=useState<string[]>([]);

  const [formData, setFormData] = useState({
    productName: '',
    productType: 'organic_acid',
    target: 'varroa',
    dosage: '',
    withholdingPeriodDays: '0',
    administeredAmount: '',
    administeredUnit: 'ml',
    supplierName: '',
    supplierAddress: '',
    acquisitionDate: new Date().toISOString().split('T')[0],
    productBatchNumber: '',
    veterinarianName: '',
    veterinarianContact: '',
    prescriptionReference: '',
    scope: 'whole_hive' as 'whole_hive' | 'colony',
    colonyNumber: '',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof treatmentsApi.create>[0]) =>
      treatmentsApi.create(data),
    onSuccess: async (response) => {
      if(response.data?.id)for(const uri of documents)await treatmentsApi.uploadDocument(response.data.id,uri);
      queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
      Alert.alert('Lagret', 'Behandlingen er registrert', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      Alert.alert('Feil', 'Kunne ikke lagre behandlingen');
    },
  });

  const handleSave = async () => {
    if (!formData.productName.trim() || !formData.administeredAmount || !formData.administeredUnit.trim() || !formData.supplierName.trim() || formData.withholdingPeriodDays === '') {
      Alert.alert('Mangler data', 'Produkt, faktisk mengde/enhet, leverandør og tilbakeholdelsestid er påkrevd');
      return;
    }

    const data = {
      hiveId,
      treatmentDate: new Date().toISOString(),
      productName: formData.productName,
      productType: formData.productType,
      target: formData.target,
      dosage: formData.dosage || undefined,
      startDate: new Date().toISOString(),
      ongoing: true,
      scope: formData.scope,
      colonyNumber: formData.scope === 'colony' ? Number(formData.colonyNumber) : undefined,
      administeredAmount: Number(formData.administeredAmount),
      administeredUnit: formData.administeredUnit,
      supplierName: formData.supplierName,
      supplierAddress: formData.supplierAddress || undefined,
      acquisitionDate: formData.acquisitionDate,
      productBatchNumber: formData.productBatchNumber || undefined,
      veterinarianName: formData.veterinarianName || undefined,
      veterinarianContact: formData.veterinarianContact || undefined,
      prescriptionReference: formData.prescriptionReference || undefined,
      withholdingPeriodDays: parseInt(formData.withholdingPeriodDays, 10),
      notes: formData.notes || undefined,
    };

    if (isOnline) {
      createMutation.mutate(data);
    } else {
      setSaving(true);
      try {
        const localId=await createTreatment(data);for(const uri of documents)await queueComplianceDocument(localId,uri);
        queryClient.invalidateQueries({ queryKey: ['hive', hiveId] });
        Alert.alert('Lagret lokalt', 'Behandlingen synkroniseres når du er tilkoblet', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch {
        Alert.alert('Feil', 'Kunne ikke lagre behandlingen lokalt');
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

      {/* Product info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="medkit-outline" size={18} color="#f59e0b" /> Produkt
        </Text>

        <Text style={styles.label}>Produktnavn *</Text>
        <TextInput
          style={styles.input}
          value={formData.productName}
          onChangeText={(v) => updateField('productName', v)}
          placeholder="F.eks. Oxalsyre, ApiLifeVar..."
          accessibilityLabel="Produktnavn"
        />

        <Text style={styles.label}>Produkttype</Text>
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

        <Text style={styles.label}>Dosering</Text>
        <TextInput
          style={styles.input}
          value={formData.dosage}
          onChangeText={(v) => updateField('dosage', v)}
          placeholder="F.eks. 5ml per ramme"
          accessibilityLabel="Dosering"
        />
      </View>

      {/* Target */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="bug-outline" size={18} color="#f59e0b" /> Behandlingsmal
        </Text>

        <View style={styles.buttonRow}>
          {targetOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionButton,
                formData.target === opt.value && styles.optionSelected,
              ]}
              onPress={() => updateField('target', opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Behandlingsmal: ${opt.label}`}
              accessibilityState={{ selected: formData.target === opt.value }}
            >
              <Text
                style={[
                  styles.optionText,
                  formData.target === opt.value && styles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Withholding period */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Administrering og anskaffelse</Text>
        <Text style={styles.label}>Faktisk administrert mengde *</Text><View style={styles.buttonRow}><TextInput style={[styles.input,{flex:2}]} value={formData.administeredAmount} onChangeText={v=>updateField('administeredAmount',v)} keyboardType="decimal-pad" placeholder="Mengde"/><TextInput style={[styles.input,{flex:1}]} value={formData.administeredUnit} onChangeText={v=>updateField('administeredUnit',v)} placeholder="Enhet"/></View>
        <Text style={styles.label}>Leverandør *</Text><TextInput style={styles.input} value={formData.supplierName} onChangeText={v=>updateField('supplierName',v)} />
        <Text style={styles.label}>Leverandøradresse</Text><TextInput style={styles.input} value={formData.supplierAddress} onChangeText={v=>updateField('supplierAddress',v)} />
        <Text style={styles.label}>Anskaffelsesdato (ÅÅÅÅ-MM-DD) *</Text><TextInput style={styles.input} value={formData.acquisitionDate} onChangeText={v=>updateField('acquisitionDate',v)} />
        <Text style={styles.label}>Preparatets batch-/lotnummer</Text><TextInput style={styles.input} value={formData.productBatchNumber} onChangeText={v=>updateField('productBatchNumber',v)} />
        <Text style={styles.label}>Omfang</Text><View style={styles.buttonRow}>{(['whole_hive','colony'] as const).map(v=><TouchableOpacity key={v} style={[styles.optionButton,formData.scope===v&&styles.optionSelected]} onPress={()=>updateField('scope',v)}><Text>{v==='whole_hive'?'Hele kuben':'Bestemt bifolk'}</Text></TouchableOpacity>)}</View>
        {formData.scope==='colony'&&<TextInput style={styles.input} value={formData.colonyNumber} onChangeText={v=>updateField('colonyNumber',v)} keyboardType="numeric" placeholder="Bifolk 1 eller 2"/>}
        <Text style={styles.label}>Veterinær og kontakt</Text><TextInput style={styles.input} value={formData.veterinarianName} onChangeText={v=>updateField('veterinarianName',v)} placeholder="Navn"/><TextInput style={styles.input} value={formData.veterinarianContact} onChangeText={v=>updateField('veterinarianContact',v)} placeholder="Kontakt"/>
        <Text style={styles.label}>Reseptreferanse</Text><TextInput style={styles.input} value={formData.prescriptionReference} onChangeText={v=>updateField('prescriptionReference',v)} />
      </View>

      {/* Withholding period */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="time-outline" size={18} color="#f59e0b" /> Tilbakeholdelse
        </Text>

        <Text style={styles.label}>Tilbakeholdelsestid (dager)</Text>
        <TextInput
          style={styles.input}
          value={formData.withholdingPeriodDays}
          onChangeText={(v) => updateField('withholdingPeriodDays', v)}
          keyboardType="numeric"
          placeholder="F.eks. 30"
          accessibilityLabel="Tilbakeholdelsestid i dager"
        />
        {formData.withholdingPeriodDays ? (
          <Text style={styles.withholdingInfo}>
            Tilbakeholdelse til:{' '}
            {new Date(
              Date.now() + parseInt(formData.withholdingPeriodDays) * 86400000
            ).toLocaleDateString('nb-NO')}
          </Text>
        ) : null}
      </View>

      {/* Notes */}
      <View style={styles.section}><Text style={styles.sectionTitle}>Kvittering, faktura eller resept</Text><PhotoPicker photos={documents} onPhotosChange={setDocuments}/></View>

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
        accessibilityLabel="Lagre behandling"
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
            <Text style={styles.saveButtonText}>Lagre behandling</Text>
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
  withholdingInfo: {
    fontSize: 13,
    color: '#f59e0b',
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
