import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Vibration } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAudioRecorderState } from 'expo-audio';
import { apiariesApi } from '../../lib/api';
import { getApiaries } from '../../services/offlineData';
import { getFieldRecorder, startFieldRecording, finishFieldRecording, listFieldRecordings, isFieldRecordingActive, transferFieldRecordings, LocalRecording } from '../../services/fieldRecordings';
import { fieldVisitsApi } from '../../lib/fieldVoice';
const labels = { awaiting_audio: 'Venter på lyd', queued: 'Overført – venter på behandling', processing: 'Hermes behandler besøket', ready: 'Ferdig behandlet – klart på PC', failed: 'Behandling feilet' };
export default function FieldModeScreen() {
  const audio = getFieldRecorder();
  const audioState = useAudioRecorderState(audio, 500);
  const [selected, setSelected] = useState('');
  const [items, setItems] = useState<LocalRecording[]>([]);
  const [busy, setBusy] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');
  const [offlineApiaries, setOfflineApiaries] = useState<Array<{ id: string; name: string }>>([]);
  const { data, isError } = useQuery({ queryKey: ['apiaries', 'field'], queryFn: () => apiariesApi.list() });
  const apiaries = data?.data || offlineApiaries;
  const refresh = async () => setItems(await listFieldRecordings());
  useEffect(() => {
    void getApiaries().then(setOfflineApiaries).catch(() => undefined); void refresh();
    const timer = setInterval(() => { void refresh(); }, 3000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (isFieldRecordingActive() && !audioState.isRecording && !busy && audioState.durationMillis > 0) {
      setBusy(true);
      void finishFieldRecording(true).then(() => { setError('Opptaket ble avbrutt. Den bevarte lyden er sikret lokalt.'); return refresh(); }).catch(e => setError(String(e))).finally(() => setBusy(false));
    }
  }, [audioState.isRecording, audioState.durationMillis, busy]);
  const send = async () => {
    setTransferring(true);
    try { await transferFieldRecordings(); await refresh(); } finally { setTransferring(false); }
  };
  const toggle = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (isFieldRecordingActive()) { await finishFieldRecording(); Vibration.vibrate([0, 100, 100, 100]); await refresh(); void send(); }
      else {
        const apiary = apiaries.find(a => a.id === selected);
        if (!apiary) throw new Error('Velg bigård først.');
        await startFieldRecording(apiary.id, apiary.name); Vibration.vibrate(150); await refresh();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Opptaket kunne ikke sikres.'); }
    finally { setBusy(false); }
  };
  const recording = isFieldRecordingActive();
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Besøk i bigården</Text>
    <Text style={styles.text}>Velg bigård, trykk Start og legg telefonen i lommen. Hele besøket tas opp lokalt. Etter Stopp sendes opptaket til Hermes.</Text>
    {isError && <Text style={styles.text}>Serveren er utilgjengelig. Lagrede bigårder kan fortsatt brukes.</Text>}
    <View style={styles.apiaries}>{apiaries.map(a => <TouchableOpacity key={a.id} disabled={recording || busy} style={[styles.choice, selected === a.id && styles.selected]} onPress={() => setSelected(a.id)}><Text>{a.name}</Text></TouchableOpacity>)}</View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={recording ? 'Stopp opptak' : 'Start opptak'} disabled={busy || (!recording && !selected)} style={[styles.record, (busy || (!recording && !selected)) && { opacity: 0.5 }]} onPress={toggle}>
      <Text style={styles.recordText}>{busy ? 'Vent …' : recording ? '■ Stopp' : '● Start'}</Text>
    </TouchableOpacity>
    <Text style={styles.status}>{recording ? `Tar opp · ${Math.floor(audioState.durationMillis / 60000)}:${String(Math.floor(audioState.durationMillis / 1000) % 60).padStart(2, '0')}` : 'Opptak er stoppet'}</Text>
    {recording && <Text style={styles.text}>Du kan låse skjermen. Ved avbrudd beholdes lyden som er tatt opp.</Text>}
    {!!error && <Text style={styles.error}>{error}</Text>}
    <TouchableOpacity disabled={transferring} style={styles.choice} onPress={send}><Text>{transferring ? 'Overfører …' : 'Send ventende opptak / oppdater status'}</Text></TouchableOpacity>
    <Text style={styles.heading}>Opptak på telefonen</Text>
    {items.map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.heading}>{item.apiaryName}</Text><Text>{new Date(item.startedAt).toLocaleString('nb-NO')}</Text>
      <Text style={styles.text}>{item.state === 'recording' ? 'Tar opp' : item.state === 'saved' ? 'Sikret på telefonen – venter på overføring' : item.state === 'missing' ? 'Lyd kunne ikke gjenopprettes' : labels[item.serverStatus || 'queued']}</Text>
      {item.interrupted && <Text style={styles.error}>Avbrutt opptak – kontroller innholdet på PC.</Text>}
      {!!item.error && <Text style={styles.error}>{item.error}</Text>}
      {item.serverStatus === 'failed' && <TouchableOpacity onPress={() => { void fieldVisitsApi.retry(item.id).then(send).catch(() => Alert.alert('Feil', 'Kunne ikke starte ny behandling.')); }}><Text style={styles.heading}>Prøv Hermes-behandling igjen</Text></TouchableOpacity>}
    </View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, backgroundColor: '#fff' }, title: { fontSize: 28, fontWeight: '700' }, text: { fontSize: 16, color: '#4b5563', lineHeight: 24 },
  apiaries: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db' }, selected: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  record: { backgroundColor: '#dc2626', borderRadius: 100, height: 170, width: 170, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' }, recordText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  status: { textAlign: 'center', fontSize: 20, fontWeight: '600' }, error: { color: '#b91c1c', lineHeight: 22 }, heading: { fontSize: 18, fontWeight: '600' }, card: { padding: 16, borderRadius: 12, backgroundColor: '#f9fafb', gap: 8 },
});
