import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { FIELD_VOICE_URL, sendFieldVoiceClip } from '../../lib/fieldVoice';

const SILENCE_THRESHOLD_DB = -42;
const SILENCE_TO_SEND_MS = 1500;
const MIN_SPEECH_MS = 500;
const MAX_RECORDING_MS = 45_000;
const NO_SPEECH_RESTART_MS = 8_000;

type FieldStatus = 'idle' | 'listening' | 'processing' | 'replying' | 'error';

interface Turn {
  transcript: string;
  replyText: string;
  at: string;
}

export default function FieldModeScreen() {
  const sessionId = useMemo(() => `birokt-field-${Date.now()}`, []);
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<FieldStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const heardSpeechAtRef = useRef<number | null>(null);
  const silenceStartedAtRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    activeRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      startListening();
      return;
    }

    if (recorderState.isRecording) {
      recorder.stop().catch(() => {});
    }
    busyRef.current = false;
    resetVoiceDetection();
    setStatus('idle');
  }, [enabled]);

  useEffect(() => {
    if (!enabled || busyRef.current || !recorderState.isRecording) return;

    const now = Date.now();
    const startedAt = recordingStartedAtRef.current ?? now;
    const duration = now - startedAt;
    const metering = recorderState.metering ?? -160;
    const isVoice = metering > SILENCE_THRESHOLD_DB;

    if (isVoice) {
      if (heardSpeechAtRef.current == null) heardSpeechAtRef.current = now;
      silenceStartedAtRef.current = null;
      return;
    }

    if (heardSpeechAtRef.current != null) {
      if (silenceStartedAtRef.current == null) silenceStartedAtRef.current = now;
      const speechMs = now - heardSpeechAtRef.current;
      const silenceMs = now - silenceStartedAtRef.current;

      if (speechMs >= MIN_SPEECH_MS && silenceMs >= SILENCE_TO_SEND_MS) {
        stopAndSubmit();
      }
      return;
    }

    if (duration >= NO_SPEECH_RESTART_MS) {
      restartEmptyRecording();
    }

    if (duration >= MAX_RECORDING_MS) {
      stopAndSubmit();
    }
  }, [
    enabled,
    recorderState.durationMillis,
    recorderState.isRecording,
    recorderState.metering,
  ]);

  useEffect(() => {
    if (status === 'replying' && playerStatus.didJustFinish) {
      setStatus('listening');
      if (activeRef.current) startListening();
    }
  }, [playerStatus.didJustFinish, status]);

  const resetVoiceDetection = () => {
    heardSpeechAtRef.current = null;
    silenceStartedAtRef.current = null;
    recordingStartedAtRef.current = null;
  };

  const ensureMicrophone = async () => {
    const current = await getRecordingPermissionsAsync();
    if (current.granted) return true;

    const requested = await requestRecordingPermissionsAsync();
    return requested.granted;
  };

  const startListening = async () => {
    if (busyRef.current || recorderState.isRecording) return;

    const granted = await ensureMicrophone();
    if (!granted) {
      setEnabled(false);
      Alert.alert('Mikrofon', 'Feltmodus trenger mikrofontilgang for a lytte.');
      return;
    }

    try {
      resetVoiceDetection();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingStartedAtRef.current = Date.now();
      setStatus('listening');
      setLastError(null);
    } catch (error) {
      setStatus('error');
      setLastError(error instanceof Error ? error.message : 'Kunne ikke starte opptak.');
    }
  };

  const restartEmptyRecording = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await recorder.stop();
    } catch {
      // Empty recordings can fail to stop cleanly on some Android devices.
    } finally {
      busyRef.current = false;
      if (activeRef.current) startListening();
    }
  };

  const stopAndSubmit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus('processing');

    try {
      await recorder.stop();
      const uri = recorder.uri;
      resetVoiceDetection();

      if (!uri) {
        throw new Error('Opptaket manglet lydfil.');
      }

      const response = await sendFieldVoiceClip(uri, { sessionId });
      setTurns((current) => [
        {
          transcript: response.transcript,
          replyText: response.replyText,
          at: new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
        },
        ...current,
      ]);

      if (response.replyAudioBase64) {
        const replyFile = new File(Paths.cache, `field-reply-${Date.now()}.mp3`);
        replyFile.write(response.replyAudioBase64, { encoding: 'base64' });
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        player.replace({ uri: replyFile.uri });
        player.play();
        setStatus('replying');
      } else if (activeRef.current) {
        setStatus('listening');
        startListening();
      }
    } catch (error) {
      setStatus('error');
      setLastError(error instanceof Error ? error.message : 'Feltmodus feilet.');
      if (activeRef.current) {
        setTimeout(() => startListening(), 1200);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const level = Math.max(0, Math.min(1, ((recorderState.metering ?? -80) + 80) / 50));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Feltmodus</Text>
          <Text style={styles.subtitle}>{FIELD_VOICE_URL}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: '#d1d5db', true: '#fbbf24' }}
          thumbColor={enabled ? '#f59e0b' : '#f9fafb'}
          accessibilityLabel={enabled ? 'Stopp feltmodus' : 'Start feltmodus'}
        />
      </View>

      <View style={styles.statusPanel}>
        <View style={[styles.micCircle, enabled && styles.micCircleActive]}>
          <Ionicons
            name={status === 'replying' ? 'volume-high-outline' : 'mic-outline'}
            size={44}
            color={enabled ? '#fff' : '#9ca3af'}
          />
        </View>
        <Text style={styles.statusText}>
          {status === 'listening' && 'Lytter'}
          {status === 'processing' && 'Sender til Edvin'}
          {status === 'replying' && 'Spiller svar'}
          {status === 'error' && 'Prover igjen'}
          {status === 'idle' && 'Av'}
        </Text>
        <View style={styles.levelTrack}>
          <View style={[styles.levelFill, { width: `${level * 100}%` }]} />
        </View>
        <Text style={styles.meterText}>
          {recorderState.metering == null
            ? 'Venter pa lydniva'
            : `${Math.round(recorderState.metering)} dB`}
        </Text>
        {lastError && <Text style={styles.errorText}>{lastError}</Text>}
      </View>

      <ScrollView contentContainerStyle={styles.turnList}>
        {turns.map((turn, index) => (
          <View key={`${turn.at}-${index}`} style={styles.turnCard}>
            <Text style={styles.turnTime}>{turn.at}</Text>
            <Text style={styles.label}>Du sa</Text>
            <Text style={styles.turnText}>{turn.transcript}</Text>
            <Text style={styles.label}>Edvin svarte</Text>
            <Text style={styles.turnText}>{turn.replyText}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  title: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
    maxWidth: 250,
  },
  statusPanel: {
    alignItems: 'center',
    padding: 28,
  },
  micCircle: {
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: 52,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },
  micCircleActive: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  levelTrack: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    height: 8,
    marginTop: 18,
    overflow: 'hidden',
    width: '80%',
  },
  levelFill: {
    backgroundColor: '#22c55e',
    height: '100%',
  },
  meterText: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  turnList: {
    padding: 16,
    paddingBottom: 32,
  },
  turnCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 14,
  },
  turnTime: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 8,
  },
  label: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  turnText: {
    color: '#1f2937',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
});
