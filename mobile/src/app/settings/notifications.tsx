import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../lib/api';

export default function NotificationSettingsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: () => notificationsApi.getSettings(),
  });

  const settings = data?.data;

  const [inspectionReminders, setInspectionReminders] = useState(true);
  const [treatmentReminders, setTreatmentReminders] = useState(true);
  const [weatherAlerts, setWeatherAlerts] = useState(true);
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');

  useEffect(() => {
    if (settings) {
      setInspectionReminders(settings.inspectionReminders);
      setTreatmentReminders(settings.treatmentReminders);
      setWeatherAlerts(settings.weatherAlerts);
      setQuietStart(settings.quietHoursStart || '');
      setQuietEnd(settings.quietHoursEnd || '');
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof notificationsApi.updateSettings>[0]) =>
      notificationsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
    },
    onError: () => {
      Alert.alert('Feil', 'Kunne ikke oppdatere innstillinger');
    },
  });

  const updateSetting = (key: string, value: boolean | string | null) => {
    mutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paminnelser</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="search-outline" size={18} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.settingLabel}>Inspeksjonspaminnelser</Text>
              <Text style={styles.settingDesc}>Paming nar kuber ikke er inspisert pa 14 dager</Text>
            </View>
          </View>
          <Switch
            value={inspectionReminders}
            onValueChange={(v) => {
              setInspectionReminders(v);
              updateSetting('inspectionReminders', v);
            }}
            trackColor={{ true: '#f59e0b' }}
            thumbColor="#fff"
            accessibilityRole="switch"
            accessibilityLabel="Inspeksjonspåminnelser"
            accessibilityState={{ checked: inspectionReminders }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={[styles.iconBox, { backgroundColor: '#fce7f3' }]}>
              <Ionicons name="medkit-outline" size={18} color="#ec4899" />
            </View>
            <View>
              <Text style={styles.settingLabel}>Behandlingspaminnelser</Text>
              <Text style={styles.settingDesc}>Varsel nar tilbakeholdelsesperiode utloper</Text>
            </View>
          </View>
          <Switch
            value={treatmentReminders}
            onValueChange={(v) => {
              setTreatmentReminders(v);
              updateSetting('treatmentReminders', v);
            }}
            trackColor={{ true: '#f59e0b' }}
            thumbColor="#fff"
            accessibilityRole="switch"
            accessibilityLabel="Behandlingspåminnelser"
            accessibilityState={{ checked: treatmentReminders }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="cloud-outline" size={18} color="#22c55e" />
            </View>
            <View>
              <Text style={styles.settingLabel}>Vaervarslinger</Text>
              <Text style={styles.settingDesc}>Varsel ved ekstremt vaer i bigardene</Text>
            </View>
          </View>
          <Switch
            value={weatherAlerts}
            onValueChange={(v) => {
              setWeatherAlerts(v);
              updateSetting('weatherAlerts', v);
            }}
            trackColor={{ true: '#f59e0b' }}
            thumbColor="#fff"
            accessibilityRole="switch"
            accessibilityLabel="Værvarsel"
            accessibilityState={{ checked: weatherAlerts }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stille timer</Text>
        <Text style={styles.sectionDesc}>
          Ingen varsler sendes i dette tidsrommet
        </Text>

        <View style={styles.quietRow}>
          <View style={styles.quietInput}>
            <Text style={styles.quietLabel}>Fra</Text>
            <TextInput
              style={styles.timeInput}
              value={quietStart}
              onChangeText={setQuietStart}
              onBlur={() => updateSetting('quietHoursStart', quietStart || null)}
              placeholder="22:00"
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Stille timer fra"
            />
          </View>
          <View style={styles.quietInput}>
            <Text style={styles.quietLabel}>Til</Text>
            <TextInput
              style={styles.timeInput}
              value={quietEnd}
              onChangeText={setQuietEnd}
              onBlur={() => updateSetting('quietHoursEnd', quietEnd || null)}
              placeholder="07:00"
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Stille timer til"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  settingDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  quietRow: {
    flexDirection: 'row',
    gap: 16,
  },
  quietInput: {
    flex: 1,
  },
  quietLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  timeInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    textAlign: 'center',
  },
});
