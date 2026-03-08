import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 16;
const GRID_GAP = 8;
const COLUMNS = 3;
const IMAGE_SIZE = (SCREEN_WIDTH - 2 * GRID_PADDING - (COLUMNS - 1) * GRID_GAP - 32) / COLUMNS;

interface PhotoPreviewProps {
  photos: string[];
  onRemove: (index: number) => void;
}

export function PhotoPreview({ photos, onRemove }: PhotoPreviewProps) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <View style={styles.grid}>
      {photos.map((uri, index) => (
        <View key={uri} style={styles.imageContainer}>
          <Image
            source={{ uri }}
            style={styles.image}
            accessibilityRole="image"
            accessibilityLabel={`Bilde ${index + 1}`}
          />
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(index)}
            accessibilityRole="button"
            accessibilityLabel="Fjern bilde"
            accessibilityHint="Fjerner dette bildet"
          >
            <Ionicons name="close-circle" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: 12,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});
