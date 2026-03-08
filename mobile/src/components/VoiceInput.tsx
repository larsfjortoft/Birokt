import { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// expo-speech-recognition requires a native build (dev client).
// Gracefully handle when running in Expo Go where the native module is unavailable.
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = null;

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {
  // Native module not available (e.g. Expo Go)
}

// No-op hook when native module is unavailable
function useNoopEvent(_event: string, _handler: any) {}

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

export function VoiceInput({ onTranscript }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const useEvent = useSpeechRecognitionEvent || useNoopEvent;

  const isAvailable = ExpoSpeechRecognitionModule != null;

  useEffect(() => {
    if (isListening) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  useEvent('result', (event: any) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      onTranscript(transcript);
    }
  });

  useEvent('end', () => {
    setIsListening(false);
  });

  useEvent('error', (event: any) => {
    setIsListening(false);
    if (event.error !== 'no-speech') {
      Alert.alert('Talefeil', 'Kunne ikke gjenkjenne tale. Prov igjen.');
    }
  });

  const toggleListening = async () => {
    if (!isAvailable) {
      Alert.alert(
        'Ikke tilgjengelig',
        'Talegjenkjenning krever en egen app-bygning (dev client). Funksjonen er ikke tilgjengelig i Expo Go.'
      );
      return;
    }

    if (isListening) {
      await ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      return;
    }

    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert('Tillatelse', 'Mikrofontilgang er nodvendig for stemmeinndata.');
      return;
    }

    try {
      await ExpoSpeechRecognitionModule.start({
        lang: 'nb-NO',
        interimResults: false,
      });
      setIsListening(true);
    } catch {
      Alert.alert('Feil', 'Kunne ikke starte talegjenkjenning.');
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[styles.button, isListening && styles.buttonActive, !isAvailable && styles.buttonDisabled]}
        onPress={toggleListening}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isListening ? 'Stopp taleopptak' : 'Start taleopptak'}
        accessibilityState={{ busy: isListening }}
      >
        <Ionicons
          name={isListening ? 'mic' : 'mic-outline'}
          size={20}
          color={isListening ? '#fff' : !isAvailable ? '#d1d5db' : '#f59e0b'}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#ef4444',
  },
  buttonDisabled: {
    backgroundColor: '#f3f4f6',
  },
});
