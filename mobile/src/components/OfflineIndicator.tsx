import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../hooks/useOffline';

export function OfflineIndicator() {
  const { isOnline, pendingOperations, isSyncing, sync } = useOffline();

  // Don't show anything if online and no pending operations
  if (isOnline && pendingOperations === 0 && !isSyncing) {
    return null;
  }

  return (
    <View
      style={[styles.container, !isOnline && styles.containerOffline]}
      accessibilityRole="alert"
      accessibilityLabel={!isOnline ? 'Frakoblet modus' : isSyncing ? 'Synkroniserer' : `${pendingOperations} ventende operasjoner`}
    >
      {!isOnline ? (
        <>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-offline" size={16} color="#fff" />
          </View>
          <Text style={styles.text}>Offline-modus</Text>
          {pendingOperations > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingOperations}</Text>
            </View>
          )}
        </>
      ) : isSyncing ? (
        <>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.text}>Synkroniserer...</Text>
        </>
      ) : pendingOperations > 0 ? (
        <>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-upload" size={16} color="#fff" />
          </View>
          <Text style={styles.text}>{pendingOperations} venter</Text>
          <TouchableOpacity
            onPress={sync}
            style={styles.syncButton}
            accessibilityRole="button"
            accessibilityLabel={`Synkroniser ${pendingOperations} ventende operasjoner`}
          >
            <Text style={styles.syncButtonText}>Synk nå</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  containerOffline: {
    backgroundColor: '#6b7280',
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
