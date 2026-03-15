import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiariesApi } from '../../lib/api';

interface Apiary {
  id: string;
  name: string;
  description?: string;
  location: { name?: string; lat?: number; lng?: number };
  hiveCount: number;
  stats: { healthy: number; warning: number; critical: number };
}

export default function HomeScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const apiaries = data?.data || [];

  const renderApiary = ({ item }: { item: Apiary }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/apiary/${item.id}`)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.hiveCount} kuber, ${item.stats.healthy} friske, ${item.stats.warning} advarsler, ${item.stats.critical} kritiske`}
      accessibilityHint="Trykk for å se bigården"
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={24} color="#f59e0b" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {item.location?.name && (
            <Text style={styles.cardSubtitle}>{item.location.name}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.hiveCount}</Text>
          <Text style={styles.statLabel}>Kuber</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.statValue}>{item.stats.healthy}</Text>
          <Text style={styles.statLabel}>Friske</Text>
        </View>
        {item.stats.warning > 0 && (
          <View style={styles.stat}>
            <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.statValue}>{item.stats.warning}</Text>
            <Text style={styles.statLabel}>Advarsel</Text>
          </View>
        )}
        {item.stats.critical > 0 && (
          <View style={styles.stat}>
            <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.statValue}>{item.stats.critical}</Text>
            <Text style={styles.statLabel}>Kritisk</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Laster bigårder...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.batchButton}
        onPress={() => router.push('/inspection/batch')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Start batch-inspeksjon"
      >
        <Ionicons name="clipboard-outline" size={20} color="#fff" />
        <Text style={styles.batchButtonText}>Batch-inspeksjon</Text>
      </TouchableOpacity>
      <FlatList
        data={apiaries}
        keyExtractor={(item) => item.id}
        renderItem={renderApiary}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#f59e0b"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Ingen bigårder</Text>
            <Text style={styles.emptyText}>
              Opprett din første bigård i nettleseren for å komme i gang
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  batchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  batchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
