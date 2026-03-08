import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { apiariesApi } from '../../lib/api';

interface Hive {
  id: string;
  hiveNumber: string;
  status: string;
  strength?: string;
}

interface ApiaryData {
  id: string;
  name: string;
  description?: string;
  location: { name?: string; lat?: number; lng?: number };
  hives: Hive[];
}

const getStrengthColor = (strength?: string) => {
  switch (strength) {
    case 'strong': return { bg: '#dcfce7', text: '#166534' };
    case 'medium': return { bg: '#fef3c7', text: '#92400e' };
    case 'weak': return { bg: '#fee2e2', text: '#991b1b' };
    default: return { bg: '#f3f4f6', text: '#6b7280' };
  }
};

export default function ApiaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['apiary', id],
    queryFn: () => apiariesApi.get(id),
  });

  const apiary = data?.data as ApiaryData | undefined;

  const renderHive = ({ item }: { item: Hive }) => {
    const strengthColors = getStrengthColor(item.strength);
    return (
      <TouchableOpacity
        style={styles.hiveCard}
        onPress={() => router.push(`/hive/${item.id}`)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Kube ${item.hiveNumber}`}
        accessibilityHint="Trykk for å se kubedetaljer"
      >
        <View style={styles.hiveNumber}>
          <Text style={styles.hiveNumberText}>{item.hiveNumber}</Text>
        </View>
        <View style={styles.hiveInfo}>
          <View style={[styles.badge, { backgroundColor: item.status === 'active' ? '#dcfce7' : '#fef3c7' }]}>
            <Text style={[styles.badgeText, { color: item.status === 'active' ? '#166534' : '#92400e' }]}>
              {item.status === 'active' ? 'Aktiv' : item.status === 'nuc' ? 'Avlegger' : item.status}
            </Text>
          </View>
          {item.strength && (
            <View style={[styles.badge, { backgroundColor: strengthColors.bg }]}>
              <Text style={[styles.badgeText, { color: strengthColors.text }]}>
                {item.strength === 'strong' ? 'Sterk' : item.strength === 'medium' ? 'Medium' : 'Svak'}
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>
    );
  };

  if (isLoading || !apiary) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Laster bigard...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: apiary.name }} />
      <View style={styles.container}>
        {/* Header info */}
        <View style={styles.header}>
          {apiary.location?.name && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color="#6b7280" />
              <Text style={styles.locationText}>{apiary.location.name}</Text>
            </View>
          )}
          {apiary.description && (
            <Text style={styles.description}>{apiary.description}</Text>
          )}
          <View style={styles.statsRow}>
            <View style={styles.statItem} accessibilityLabel={`${apiary.hives.length} kuber totalt`}>
              <Text style={styles.statValue}>{apiary.hives.length}</Text>
              <Text style={styles.statLabel}>Kuber</Text>
            </View>
            <View style={styles.statItem} accessibilityLabel={`${apiary.hives.filter(h => h.status === 'active').length} aktive kuber`}>
              <Text style={styles.statValue}>
                {apiary.hives.filter(h => h.status === 'active').length}
              </Text>
              <Text style={styles.statLabel}>Aktive</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.batchButton}
            onPress={() => router.push('/inspection/batch')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Start batch-inspeksjon"
          >
            <Ionicons name="clipboard-outline" size={18} color="#fff" />
            <Text style={styles.batchButtonText}>Batch-inspeksjon</Text>
          </TouchableOpacity>
        </View>

        {/* Hives list */}
        <Text style={styles.sectionTitle}>Kuber</Text>
        <FlatList
          data={apiary.hives}
          keyExtractor={(item) => item.id}
          renderItem={renderHive}
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
              <Ionicons name="cube-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>Ingen kuber i denne bigarden</Text>
            </View>
          }
        />
      </View>
    </>
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
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  batchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  batchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  hiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  hiveNumber: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hiveNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400e',
  },
  hiveInfo: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
});
