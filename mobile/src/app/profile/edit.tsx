import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
  }, [user]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Navn mangler', 'Skriv inn navnet ditt.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || null });
      router.back();
    } catch {
      Alert.alert('Kunne ikke lagre', 'Sjekk tilkoblingen til Birøkt på Raspberry Pi og prøv igjen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Navn</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} autoCapitalize="words" />
      <Text style={styles.label}>E-post</Text>
      <Text style={[styles.input, styles.disabled]}>{user?.email}</Text>
      <Text style={styles.label}>Telefon</Text>
      <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
      <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={save} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Lagrer …' : 'Lagre endringer'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  label: { color: '#374151', fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 12, color: '#1f2937', fontSize: 16, padding: 14 },
  disabled: { color: '#6b7280' },
  button: { backgroundColor: '#f59e0b', borderRadius: 12, marginTop: 28, padding: 15, alignItems: 'center' },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
