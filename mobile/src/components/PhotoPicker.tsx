import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { compressImage, isFileSizeValid } from '../lib/imageUtils';
import { logError } from '../lib/sentry';

const MAX_PHOTOS = 10;

interface PhotoPickerProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

export function PhotoPicker({ photos, onPhotosChange }: PhotoPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const remainingSlots = MAX_PHOTOS - photos.length;

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Tillatelse kreves',
        'Appen trenger tilgang til kameraet for å ta bilder.'
      );
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Tillatelse kreves',
        'Appen trenger tilgang til bildebiblioteket for å velge bilder.'
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    setModalVisible(false);

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      logError(error, { context: 'takePhoto' });
      Alert.alert('Feil', 'Kunne ikke ta bilde');
    }
  };

  const handleChooseFromGallery = async () => {
    setModalVisible(false);

    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });

      if (!result.canceled && result.assets.length > 0) {
        for (const asset of result.assets) {
          await processImage(asset.uri);
        }
      }
    } catch (error) {
      logError(error, { context: 'chooseFromGallery' });
      Alert.alert('Feil', 'Kunne ikke velge bilder');
    }
  };

  const processImage = async (uri: string) => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Maks antall bilder', `Du kan maksimalt legge til ${MAX_PHOTOS} bilder.`);
      return;
    }

    try {
      const compressed = await compressImage(uri);

      const isValid = await isFileSizeValid(compressed.uri);
      if (!isValid) {
        Alert.alert('For stort bilde', 'Bildet er fortsatt for stort etter komprimering (maks 5MB).');
        return;
      }

      onPhotosChange([...photos, compressed.uri]);
    } catch (error) {
      logError(error, { context: 'compressImage' });
      Alert.alert('Feil', 'Kunne ikke behandle bildet');
    }
  };

  const handlePress = () => {
    if (remainingSlots <= 0) {
      Alert.alert('Maks antall bilder', `Du kan maksimalt legge til ${MAX_PHOTOS} bilder.`);
      return;
    }
    setModalVisible(true);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.addButton}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Legg til bilde"
        accessibilityHint="Åpner kamera- eller gallerivalg"
      >
        <Ionicons name="camera-outline" size={24} color="#f59e0b" />
        <Text style={styles.addButtonText}>Legg til bilde</Text>
        <Text style={styles.remainingText}>({remainingSlots} igjen)</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Legg til bilde</Text>

            <TouchableOpacity
              style={styles.option}
              onPress={handleTakePhoto}
              accessibilityRole="button"
              accessibilityLabel="Ta bilde med kamera"
            >
              <Ionicons name="camera-outline" size={24} color="#1f2937" />
              <Text style={styles.optionText}>Ta bilde</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={handleChooseFromGallery}
              accessibilityRole="button"
              accessibilityLabel="Velg bilde fra galleri"
            >
              <Ionicons name="images-outline" size={24} color="#1f2937" />
              <Text style={styles.optionText}>Velg fra galleri</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, styles.cancelOption]}
              onPress={() => setModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Avbryt"
            >
              <Text style={styles.cancelText}>Avbryt</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderStyle: 'dashed',
    paddingVertical: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
  },
  remainingText: {
    fontSize: 14,
    color: '#92400e',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  cancelOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
});
