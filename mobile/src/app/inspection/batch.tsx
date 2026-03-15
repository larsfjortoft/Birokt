import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { apiariesApi, hivesApi, inspectionsApi } from '../../lib/api';
import { VoiceInput } from '../../components/VoiceInput';

const strengthOptions = [
  { value: 'strong', label: 'Sterk', color: '#dcfce7', textColor: '#166534' },
  { value: 'medium', label: 'Medium', color: '#fef3c7', textColor: '#92400e' },
  { value: 'weak', label: 'Svak', color: '#fee2e2', textColor: '#991b1b' },
];

const healthOptions = [
  { value: 'healthy', label: 'Frisk', color: '#dcfce7', textColor: '#166534' },
  { value: 'warning', label: 'Advarsel', color: '#fef3c7', textColor: '#92400e' },
  { value: 'critical', label: 'Kritisk', color: '#fee2e2', textColor: '#991b1b' },
];

const actionOptions = [
  { value: 'swarm_tendency', label: 'Svermetrang' },
  { value: 'hunger', label: 'Sult' },
  { value: 'space_shortage', label: 'Plassmangel' },
];

const actionLabels: Record<string, string> = {
  swarm_tendency: 'Svermetrang',
  hunger: 'Sult',
  space_shortage: 'Plassmangel',
};

interface QuickFormData {
  strength: string;
  healthStatus: string;
  queenSeen: boolean;
  queenLaying: boolean;
  broodFrames: string;
  honeyFrames: string;
  notes: string;
  selectedActions: string[];
}

interface InspectedHive {
  id: string;
  hiveNumber: string;
  strength: string;
  healthStatus: string;
  actions: string[];
}

const defaultFormData: QuickFormData = {
  strength: 'medium',
  healthStatus: 'healthy',
  queenSeen: false,
  queenLaying: false,
  broodFrames: '',
  honeyFrames: '',
  notes: '',
  selectedActions: [],
};

export default function BatchInspectionScreen() {
  const [mode, setMode] = useState<'qr' | 'list'>('list');
  const [inspected, setInspected] = useState<InspectedHive[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  // QR mode state
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [qrHive, setQrHive] = useState<{ id: string; hiveNumber: string } | null>(null);
  const [qrForm, setQrForm] = useState<QuickFormData>({ ...defaultFormData });
  const [showQrModal, setShowQrModal] = useState(false);

  // List mode state
  const [selectedApiaryId, setSelectedApiaryId] = useState<string | null>(null);
  const [expandedHiveId, setExpandedHiveId] = useState<string | null>(null);
  const [listForm, setListForm] = useState<QuickFormData>({ ...defaultFormData });

  const [saving, setSaving] = useState(false);

  const { data: apiariesData } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });
  const apiaries = (apiariesData?.data || []) as Array<{ id: string; name: string; hiveCount: number }>;

  const { data: apiaryData } = useQuery({
    queryKey: ['apiary', selectedApiaryId],
    queryFn: () => apiariesApi.get(selectedApiaryId!),
    enabled: !!selectedApiaryId,
  });
  const hives = ((apiaryData?.data as { hives?: Array<{ id: string; hiveNumber: string; status: string; strength?: string }> })?.hives || []);

  const totalHives = hives.length;

  const handleQrScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || isSearching) return;
    setScanned(true);
    setIsSearching(true);

    try {
      const qrCode = data.replace(/^.*QR-/, 'QR-');
      const response = await hivesApi.getByQr(qrCode);
      if (response.data) {
        const hive = response.data as { id: string; hiveNumber: string };
        setQrHive(hive);
        setQrForm({ ...defaultFormData });
        setShowQrModal(true);
      } else {
        Alert.alert('Ikke funnet', 'Fant ingen kube med denne QR-koden');
      }
    } catch {
      Alert.alert('Feil', 'Kunne ikke finne kube.');
    } finally {
      setIsSearching(false);
    }
  };

  const saveInspection = useCallback(async (hiveId: string, hiveNumber: string, form: QuickFormData) => {
    setSaving(true);
    try {
      await inspectionsApi.create({
        hiveId,
        inspectionDate: new Date().toISOString(),
        assessment: {
          strength: form.strength,
          queenSeen: form.queenSeen,
          queenLaying: form.queenLaying,
        },
        frames: {
          brood: form.broodFrames ? parseInt(form.broodFrames) : undefined,
          honey: form.honeyFrames ? parseInt(form.honeyFrames) : undefined,
        },
        health: {
          status: form.healthStatus,
        },
        actions: form.selectedActions.length > 0 ? form.selectedActions.map((a) => ({ actionType: a })) : undefined,
        notes: form.notes || undefined,
      });

      setInspected((prev) => [
        ...prev,
        { id: hiveId, hiveNumber, strength: form.strength, healthStatus: form.healthStatus, actions: form.selectedActions },
      ]);
      return true;
    } catch {
      Alert.alert('Feil', 'Kunne ikke lagre inspeksjon');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const handleQrSave = async () => {
    if (!qrHive) return;
    const ok = await saveInspection(qrHive.id, qrHive.hiveNumber, qrForm);
    if (ok) {
      setShowQrModal(false);
      setQrHive(null);
      setScanned(false);
    }
  };

  const handleListSave = async (hiveId: string, hiveNumber: string) => {
    const ok = await saveInspection(hiveId, hiveNumber, listForm);
    if (ok) {
      setExpandedHiveId(null);
      setListForm({ ...defaultFormData });
    }
  };

  const isInspected = (hiveId: string) => inspected.some((h) => h.id === hiveId);

  const renderQuickForm = (form: QuickFormData, setForm: (f: QuickFormData) => void) => (
    <View style={styles.quickForm}>
      <Text style={styles.formLabel}>Styrke</Text>
      <View style={styles.buttonRow}>
        {strengthOptions.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.colorButton,
              { backgroundColor: form.strength === opt.value ? opt.color : '#f3f4f6' },
            ]}
            onPress={() => setForm({ ...form, strength: opt.value })}
            accessibilityRole="button"
            accessibilityLabel={`Styrke: ${opt.label}`}
            accessibilityState={{ selected: form.strength === opt.value }}
          >
            <Text style={[styles.colorButtonText, { color: form.strength === opt.value ? opt.textColor : '#6b7280' }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.formLabel}>Helse</Text>
      <View style={styles.buttonRow}>
        {healthOptions.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.colorButton,
              { backgroundColor: form.healthStatus === opt.value ? opt.color : '#f3f4f6' },
            ]}
            onPress={() => setForm({ ...form, healthStatus: opt.value })}
            accessibilityRole="button"
            accessibilityLabel={`Helse: ${opt.label}`}
            accessibilityState={{ selected: form.healthStatus === opt.value }}
          >
            <Text style={[styles.colorButtonText, { color: form.healthStatus === opt.value ? opt.textColor : '#6b7280' }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.checkboxRow}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setForm({ ...form, queenSeen: !form.queenSeen })}
          accessibilityRole="checkbox"
          accessibilityLabel="Dronning sett"
          accessibilityState={{ checked: form.queenSeen }}
        >
          <Ionicons
            name={form.queenSeen ? 'checkbox' : 'square-outline'}
            size={22}
            color={form.queenSeen ? '#f59e0b' : '#9ca3af'}
          />
          <Text style={styles.checkboxLabel}>Dronning sett</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setForm({ ...form, queenLaying: !form.queenLaying })}
          accessibilityRole="checkbox"
          accessibilityLabel="Legger egg"
          accessibilityState={{ checked: form.queenLaying }}
        >
          <Ionicons
            name={form.queenLaying ? 'checkbox' : 'square-outline'}
            size={22}
            color={form.queenLaying ? '#f59e0b' : '#9ca3af'}
          />
          <Text style={styles.checkboxLabel}>Legger egg</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.framesRow}>
        <View style={styles.frameInput}>
          <Text style={styles.formLabel}>Yngelrammer</Text>
          <TextInput
            style={styles.input}
            value={form.broodFrames}
            onChangeText={(v) => setForm({ ...form, broodFrames: v })}
            keyboardType="numeric"
            placeholder="0"
            accessibilityLabel="Antall yngelrammer"
          />
        </View>
        <View style={styles.frameInput}>
          <Text style={styles.formLabel}>Honningrammer</Text>
          <TextInput
            style={styles.input}
            value={form.honeyFrames}
            onChangeText={(v) => setForm({ ...form, honeyFrames: v })}
            keyboardType="numeric"
            placeholder="0"
            accessibilityLabel="Antall honningrammer"
          />
        </View>
      </View>

      <View style={styles.notesRow}>
        <Text style={styles.formLabel}>Notat</Text>
        <VoiceInput
          onTranscript={(text) => setForm({ ...form, notes: form.notes ? form.notes + ' ' + text : text })}
        />
      </View>
      <TextInput
        style={styles.notesInput}
        value={form.notes}
        onChangeText={(v) => setForm({ ...form, notes: v })}
        placeholder="Kort notat..."
        multiline
        accessibilityLabel="Notat"
      />

      <Text style={[styles.formLabel, { marginTop: 12 }]}>Handling</Text>
      <View style={styles.buttonRow}>
        {actionOptions.map((opt) => {
          const isSelected = form.selectedActions.includes(opt.value);
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.actionToggle,
                isSelected && styles.actionToggleSelected,
              ]}
              onPress={() => {
                const next = isSelected
                  ? form.selectedActions.filter((v) => v !== opt.value)
                  : [...form.selectedActions, opt.value];
                setForm({ ...form, selectedActions: next });
              }}
              accessibilityRole="checkbox"
              accessibilityLabel={`Handling: ${opt.label}`}
              accessibilityState={{ checked: isSelected }}
            >
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={16}
                color={isSelected ? '#f59e0b' : '#9ca3af'}
              />
              <Text style={[styles.actionToggleText, isSelected && styles.actionToggleTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Summary view
  if (showSummary) {
    return (
      <View style={styles.container}>
        <View style={styles.summaryHeader}>
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
          <Text style={styles.summaryTitle}>Batch-inspeksjon ferdig</Text>
          <Text style={styles.summarySubtitle}>{inspected.length} kuber inspisert</Text>
        </View>
        <FlatList
          data={inspected}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.summaryList}
          renderItem={({ item }) => (
            <View style={styles.summaryItem}>
              <View style={styles.summaryHiveNumber}>
                <Text style={styles.summaryHiveNumberText}>{item.hiveNumber}</Text>
              </View>
              <View style={styles.summaryBadges}>
                {strengthOptions.filter((o) => o.value === item.strength).map((o) => (
                  <View key={o.value} style={[styles.badge, { backgroundColor: o.color }]}>
                    <Text style={[styles.badgeText, { color: o.textColor }]}>{o.label}</Text>
                  </View>
                ))}
                {healthOptions.filter((o) => o.value === item.healthStatus).map((o) => (
                  <View key={o.value} style={[styles.badge, { backgroundColor: o.color }]}>
                    <Text style={[styles.badgeText, { color: o.textColor }]}>{o.label}</Text>
                  </View>
                ))}
                {item.actions.map((a) => (
                  <View key={a} style={[styles.badge, { backgroundColor: '#fff7ed' }]}>
                    <Text style={[styles.badgeText, { color: '#c2410c' }]}>{actionLabels[a] || a}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Ferdig</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress banner */}
      <View style={styles.progressBanner}>
        <Ionicons name="clipboard-outline" size={18} color="#92400e" />
        <Text style={styles.progressText}>
          {inspected.length} av {mode === 'list' ? totalHives : '?'} kuber inspisert
        </Text>
        {inspected.length > 0 && (
          <TouchableOpacity onPress={() => setShowSummary(true)}>
            <Text style={styles.finishLink}>Avslutt</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'list' && styles.modeButtonActive]}
          onPress={() => setMode('list')}
          accessibilityRole="tab"
          accessibilityLabel="Liste-modus"
          accessibilityState={{ selected: mode === 'list' }}
        >
          <Ionicons name="list-outline" size={18} color={mode === 'list' ? '#fff' : '#6b7280'} />
          <Text style={[styles.modeButtonText, mode === 'list' && styles.modeButtonTextActive]}>Liste</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'qr' && styles.modeButtonActive]}
          onPress={() => setMode('qr')}
          accessibilityRole="tab"
          accessibilityLabel="QR-skann-modus"
          accessibilityState={{ selected: mode === 'qr' }}
        >
          <Ionicons name="qr-code-outline" size={18} color={mode === 'qr' ? '#fff' : '#6b7280'} />
          <Text style={[styles.modeButtonText, mode === 'qr' && styles.modeButtonTextActive]}>QR-skann</Text>
        </TouchableOpacity>
      </View>

      {mode === 'qr' ? (
        // QR Mode
        <View style={styles.qrContainer}>
          {!permission?.granted ? (
            <View style={styles.centered}>
              <Text style={styles.permText}>Kameratilgang kreves for QR-skanning</Text>
              <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
                <Text style={styles.permButtonText}>Gi tilgang</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : handleQrScanned}
              accessibilityLabel="QR-skanner"
            >
              <View style={styles.overlay}>
                <View style={styles.scanArea}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.instruction}>
                  {isSearching ? 'Søker...' : 'Skann kube-QR for rask inspeksjon'}
                </Text>
              </View>
            </CameraView>
          )}

          {/* QR Quick-form modal */}
          <Modal visible={showQrModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Kube {qrHive?.hiveNumber}</Text>
                  <TouchableOpacity onPress={() => { setShowQrModal(false); setScanned(false); }}>
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScroll}>
                  {renderQuickForm(qrForm, setQrForm)}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleQrSave}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Lagre batch-inspeksjon"
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                      <Text style={styles.saveButtonText}>Lagre</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      ) : (
        // List Mode
        <View style={styles.listContainer}>
          {/* Apiary selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.apiaryScroll}>
            {apiaries.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.apiaryChip, selectedApiaryId === a.id && styles.apiaryChipActive]}
                onPress={() => {
                  setSelectedApiaryId(a.id);
                  setExpandedHiveId(null);
                }}
              >
                <Text style={[styles.apiaryChipText, selectedApiaryId === a.id && styles.apiaryChipTextActive]}>
                  {a.name} ({a.hiveCount})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {!selectedApiaryId ? (
            <View style={styles.centered}>
              <Ionicons name="location-outline" size={48} color="#d1d5db" />
              <Text style={styles.selectText}>Velg en bigård for å starte</Text>
            </View>
          ) : (
            <FlatList
              data={hives}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.hiveList}
              renderItem={({ item }) => {
                const done = isInspected(item.id);
                const expanded = expandedHiveId === item.id;

                return (
                  <View style={styles.hiveItem}>
                    <TouchableOpacity
                      style={styles.hiveRow}
                      onPress={() => {
                        if (done) return;
                        if (expanded) {
                          setExpandedHiveId(null);
                        } else {
                          setExpandedHiveId(item.id);
                          setListForm({ ...defaultFormData });
                        }
                      }}
                      disabled={done}
                      accessibilityRole="button"
                      accessibilityLabel={`Kube ${item.hiveNumber}${done ? ', inspisert' : ''}`}
                      accessibilityState={{ expanded, disabled: done }}
                    >
                      <View style={[styles.hiveNumberBadge, done && styles.hiveNumberDone]}>
                        {done ? (
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        ) : (
                          <Text style={styles.hiveNumberText}>{item.hiveNumber}</Text>
                        )}
                      </View>
                      <Text style={[styles.hiveName, done && styles.hiveNameDone]}>
                        Kube {item.hiveNumber}
                      </Text>
                      {!done && (
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#9ca3af"
                        />
                      )}
                    </TouchableOpacity>

                    {expanded && !done && (
                      <View style={styles.expandedForm}>
                        {renderQuickForm(listForm, setListForm)}
                        <TouchableOpacity
                          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                          onPress={() => handleListSave(item.id, item.hiveNumber)}
                          disabled={saving}
                          accessibilityRole="button"
                          accessibilityLabel="Lagre batch-inspeksjon"
                        >
                          {saving ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={20} color="#fff" />
                              <Text style={styles.saveButtonText}>Lagre inspeksjon</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 12,
    paddingHorizontal: 16,
  },
  progressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e',
  },
  finishLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  modeToggle: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    padding: 3,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#f59e0b',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  // QR Mode
  qrContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 220,
    height: 220,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#f59e0b',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  instruction: {
    color: '#fff',
    fontSize: 15,
    marginTop: 24,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  permButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectText: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 12,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalScroll: {
    maxHeight: 400,
  },
  // List mode
  listContainer: {
    flex: 1,
  },
  apiaryScroll: {
    maxHeight: 44,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  apiaryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  apiaryChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  apiaryChipText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  apiaryChipTextActive: {
    color: '#fff',
  },
  hiveList: {
    padding: 16,
    paddingTop: 8,
  },
  hiveItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  hiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  hiveNumberBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hiveNumberDone: {
    backgroundColor: '#22c55e',
  },
  hiveNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400e',
  },
  hiveName: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  hiveNameDone: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  expandedForm: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  // Quick form
  quickForm: {
    paddingVertical: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  colorButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  colorButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#374151',
  },
  framesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  frameInput: {
    flex: 1,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#1f2937',
  },
  notesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  notesInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#1f2937',
    minHeight: 50,
    marginTop: 4,
  },
  actionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  actionToggleSelected: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  actionToggleText: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionToggleTextSelected: {
    color: '#92400e',
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    marginTop: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Summary
  summaryHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
  },
  summarySubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 4,
  },
  summaryList: {
    paddingHorizontal: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  summaryHiveNumber: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryHiveNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#166534',
  },
  summaryBadges: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    margin: 16,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
