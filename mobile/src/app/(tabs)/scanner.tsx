import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { hivesApi } from '../../lib/api';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || isSearching) return;

    setScanned(true);
    setIsSearching(true);

    try {
      // Extract QR code value (remove any prefix if present)
      const qrCode = data.replace(/^.*QR-/, 'QR-');

      const response = await hivesApi.getByQr(qrCode);

      if (response.data) {
        const hive = response.data as { id: string };
        router.push(`/hive/${hive.id}`);
      } else {
        Alert.alert('Ikke funnet', 'Fant ingen kube med denne QR-koden');
      }
    } catch {
      Alert.alert('Feil', 'Kunne ikke finne kube. Sjekk at QR-koden er gyldig.');
    } finally {
      setIsSearching(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Laster kamera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-off-outline" size={64} color="#d1d5db" />
        <Text style={styles.title}>Kameratilgang kreves</Text>
        <Text style={styles.text}>
          Birokt trenger tilgang til kameraet for a skanne QR-koder pa kubene
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Gi tilgang</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        accessibilityLabel="QR-skanner kameravisning"
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <Text style={styles.instruction}>
            {isSearching ? 'Soker...' : 'Plasser QR-koden i rammen'}
          </Text>
        </View>
      </CameraView>

      {scanned && !isSearching && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => setScanned(false)}
            accessibilityRole="button"
            accessibilityLabel="Skann på nytt"
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.buttonText}>Skann pa nytt</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#f59e0b',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    marginTop: 32,
    fontWeight: '500',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
