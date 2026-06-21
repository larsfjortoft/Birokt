import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Pressable style={styles.row} onPress={() => router.push('/settings/notifications')}>
        <Ionicons name="notifications-outline" size={22} color="#f59e0b" />
        <View style={styles.copy}>
          <Text style={styles.title}>Varsler</Text>
          <Text style={styles.description}>Påminnelser og stille timer</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  copy: { flex: 1, marginLeft: 14 },
  title: { color: '#1f2937', fontSize: 16, fontWeight: '600' },
  description: { color: '#6b7280', fontSize: 13, marginTop: 2 },
});
