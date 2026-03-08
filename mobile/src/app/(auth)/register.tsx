import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../stores/auth';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuthStore();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Feil', 'Vennligst fyll inn alle felt');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Feil', 'Passordene er ikke like');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Feil', 'Passord ma vaere minst 8 tegn');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, name);
      router.replace('/(tabs)/home');
    } catch (error: unknown) {
      const err = error as { error?: { message?: string } };
      Alert.alert('Registrering feilet', err?.error?.message || 'Noe gikk galt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>Birokt</Text>
        <Text style={styles.subtitle}>Opprett din konto</Text>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <Text style={styles.title}>Registrer deg</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Navn</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ditt navn"
            autoComplete="name"
            accessibilityLabel="Navn"
            accessibilityHint="Skriv inn fullt navn"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>E-post</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="din@epost.no"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="E-postadresse"
            accessibilityHint="Skriv inn e-postadressen din"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Passord</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Minst 8 tegn"
            secureTextEntry
            autoComplete="new-password"
            accessibilityLabel="Passord"
            accessibilityHint="Velg et passord"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bekreft passord</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Gjenta passord"
            secureTextEntry
            autoComplete="new-password"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Opprett konto"
          accessibilityState={{ disabled: isSubmitting }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Opprett konto</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Har du allerede konto?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel="Logg inn"
            >
              <Text style={styles.link}>Logg inn</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f59e0b',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  form: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  formContent: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    gap: 4,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 14,
  },
  link: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
});
