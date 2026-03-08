import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { hivesApi } from '../../lib/api';

interface HiveData {
  id: string;
  hiveNumber: string;
  qrCode?: string;
  apiary: { id: string; name: string; location?: { name?: string; lat?: number; lng?: number } };
  status: string;
  strength?: string;
  hiveType: string;
  boxCount: number;
  queen: { year?: number; marked: boolean; color?: string; race?: string };
  currentFrames: { brood: number; honey: number };
  inspections: Array<{
    id: string;
    inspectionDate: string;
    strength?: string;
    healthStatus: string;
    notes?: string;
    photos?: string[];
  }>;
  treatments: Array<{
    id: string;
    date: string;
    product: string;
    withholdingEnd?: string;
  }>;
  notes?: string;
}

const getStrengthColor = (strength?: string) => {
  switch (strength) {
    case 'strong': return { bg: '#dcfce7', text: '#166534' };
    case 'medium': return { bg: '#fef3c7', text: '#92400e' };
    case 'weak': return { bg: '#fee2e2', text: '#991b1b' };
    default: return { bg: '#f3f4f6', text: '#6b7280' };
  }
};

const getHealthColor = (status: string) => {
  switch (status) {
    case 'healthy': return { bg: '#dcfce7', text: '#166534' };
    case 'warning': return { bg: '#fef3c7', text: '#92400e' };
    case 'critical': return { bg: '#fee2e2', text: '#991b1b' };
    default: return { bg: '#f3f4f6', text: '#6b7280' };
  }
};

const getQueenColorHex = (color?: string) => {
  const colors: Record<string, string> = {
    white: '#ffffff',
    yellow: '#fbbf24',
    red: '#ef4444',
    green: '#22c55e',
    blue: '#3b82f6',
  };
  return colors[color || ''] || '#9ca3af';
};

export default function HiveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['hive', id],
    queryFn: () => hivesApi.get(id),
  });

  const hive = data?.data as HiveData | undefined;

  if (isLoading || !hive) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Laster kube...</Text>
      </View>
    );
  }

  const strengthColors = getStrengthColor(hive.strength);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#f59e0b"
        />
      }
    >
      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.hiveNumber}>
            <Text style={styles.hiveNumberText}>{hive.hiveNumber}</Text>
          </View>
          <View>
            <Text style={styles.apiaryName}>{hive.apiary.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.badge, { backgroundColor: hive.status === 'active' ? '#dcfce7' : '#fef3c7' }]}>
                <Text style={[styles.badgeText, { color: hive.status === 'active' ? '#166534' : '#92400e' }]}>
                  {hive.status === 'active' ? 'Aktiv' : hive.status === 'nuc' ? 'Avlegger' : hive.status}
                </Text>
              </View>
              {hive.strength && (
                <View style={[styles.badge, { backgroundColor: strengthColors.bg }]}>
                  <Text style={[styles.badgeText, { color: strengthColors.text }]}>
                    {hive.strength === 'strong' ? 'Sterk' : hive.strength === 'medium' ? 'Medium' : 'Svak'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.newInspectionButton}
            onPress={() => router.push({ pathname: '/inspection/new', params: {
              hiveId: id,
              hiveNumber: hive.hiveNumber,
              ...(hive.apiary.location?.lat && hive.apiary.location?.lng ? {
                apiaryLat: String(hive.apiary.location.lat),
                apiaryLng: String(hive.apiary.location.lng),
              } : {}),
            } })}
            accessibilityRole="button"
            accessibilityLabel="Ny inspeksjon"
            accessibilityHint="Trykk for å registrere ny inspeksjon"
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newInspectionText}>Ny inspeksjon</Text>
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push({ pathname: '/treatment/new', params: { hiveId: id, hiveNumber: hive.hiveNumber } })}
              accessibilityRole="button"
              accessibilityLabel="Ny behandling"
              accessibilityHint="Trykk for å registrere ny behandling"
            >
              <Ionicons name="medkit-outline" size={16} color="#92400e" />
              <Text style={styles.secondaryButtonText}>Behandling</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push({ pathname: '/feeding/new', params: { hiveId: id, hiveNumber: hive.hiveNumber } })}
              accessibilityRole="button"
              accessibilityLabel="Ny foring"
              accessibilityHint="Trykk for å registrere ny foring"
            >
              <Ionicons name="water-outline" size={16} color="#92400e" />
              <Text style={styles.secondaryButtonText}>Foring</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push({ pathname: '/production/new', params: { hiveId: id, hiveNumber: hive.hiveNumber } })}
              accessibilityRole="button"
              accessibilityLabel="Ny produksjon"
              accessibilityHint="Trykk for å registrere ny produksjon"
            >
              <Ionicons name="flask-outline" size={16} color="#92400e" />
              <Text style={styles.secondaryButtonText}>Produksjon</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard} accessibilityLabel={`Kasser: ${hive.boxCount}`}>
          <Text style={styles.statLabel}>Kasser</Text>
          <Text style={styles.statValue}>{hive.boxCount}</Text>
        </View>
        <View style={styles.statCard} accessibilityLabel={`Yngelrammer: ${hive.currentFrames.brood}`}>
          <Text style={styles.statLabel}>Yngelrammer</Text>
          <Text style={styles.statValue}>{hive.currentFrames.brood}</Text>
        </View>
        <View style={styles.statCard} accessibilityLabel={`Honningrammer: ${hive.currentFrames.honey}`}>
          <Text style={styles.statLabel}>Honningrammer</Text>
          <Text style={styles.statValue}>{hive.currentFrames.honey}</Text>
        </View>
      </View>

      {/* Queen info */}
      {hive.queen?.year && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="sparkles" size={18} color="#f59e0b" /> Dronning
          </Text>
          <View style={styles.queenInfo} accessibilityLabel="Dronninginformasjon">
            <View style={styles.queenRow} accessibilityLabel={`Dronningens ar: ${hive.queen.year}`}>
              <Text style={styles.queenLabel}>Ar</Text>
              <Text style={styles.queenValue}>{hive.queen.year}</Text>
            </View>
            {hive.queen.race && (
              <View style={styles.queenRow} accessibilityLabel={`Dronningens rase: ${hive.queen.race}`}>
                <Text style={styles.queenLabel}>Rase</Text>
                <Text style={styles.queenValue}>{hive.queen.race}</Text>
              </View>
            )}
            <View style={styles.queenRow} accessibilityLabel={`Dronning merket: ${hive.queen.marked ? 'Ja' : 'Nei'}`}>
              <Text style={styles.queenLabel}>Merket</Text>
              <Text style={styles.queenValue}>{hive.queen.marked ? 'Ja' : 'Nei'}</Text>
            </View>
            {hive.queen.color && (
              <View style={styles.queenRow} accessibilityLabel={`Dronningens farge: ${hive.queen.color}`}>
                <Text style={styles.queenLabel}>Farge</Text>
                <View style={styles.colorIndicator}>
                  <View style={[styles.colorDot, { backgroundColor: getQueenColorHex(hive.queen.color) }]} />
                  <Text style={styles.queenValue}>{hive.queen.color}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Recent inspections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="calendar" size={18} color="#f59e0b" /> Siste inspeksjoner
        </Text>
        {hive.inspections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Ingen inspeksjoner enna</Text>
          </View>
        ) : (
          hive.inspections.slice(0, 5).map((inspection) => {
            const healthColors = getHealthColor(inspection.healthStatus);
            const date = new Date(inspection.inspectionDate);
            return (
              <View key={inspection.id} style={styles.inspectionItem}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>{date.getDate()}</Text>
                  <Text style={styles.dateMonth}>
                    {date.toLocaleDateString('nb-NO', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.inspectionContent}>
                  <View style={styles.inspectionBadges}>
                    <View style={[styles.badge, { backgroundColor: healthColors.bg }]}>
                      <Text style={[styles.badgeText, { color: healthColors.text }]}>
                        {inspection.healthStatus === 'healthy' ? 'Frisk' :
                         inspection.healthStatus === 'warning' ? 'Advarsel' : 'Kritisk'}
                      </Text>
                    </View>
                    {inspection.photos && inspection.photos.length > 0 && (
                      <View style={styles.photoBadge}>
                        <Ionicons name="camera" size={12} color="#6b7280" />
                        <Text style={styles.photoBadgeText}>{inspection.photos.length}</Text>
                      </View>
                    )}
                  </View>
                  {inspection.photos && inspection.photos.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.photoThumbnails}
                    >
                      {inspection.photos.slice(0, 4).map((photo, index) => (
                        <Image
                          key={index}
                          source={{ uri: photo }}
                          style={styles.thumbnail}
                          accessibilityRole="image"
                          accessibilityLabel={`Kubefoto ${index + 1}`}
                        />
                      ))}
                      {inspection.photos.length > 4 && (
                        <View style={styles.morePhotos}>
                          <Text style={styles.morePhotosText}>+{inspection.photos.length - 4}</Text>
                        </View>
                      )}
                    </ScrollView>
                  )}
                  {inspection.notes && (
                    <Text style={styles.inspectionNotes} numberOfLines={2}>
                      {inspection.notes}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Notes */}
      {hive.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text" size={18} color="#f59e0b" /> Notater
          </Text>
          <Text style={styles.notesText}>{hive.notes}</Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
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
  headerCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  hiveNumber: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hiveNumberText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#92400e',
  },
  apiaryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    gap: 8,
  },
  newInspectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  newInspectionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 4,
  },
  secondaryButtonText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  queenInfo: {
    gap: 8,
  },
  queenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  queenLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  queenValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  colorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  inspectionItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dateBox: {
    width: 48,
    alignItems: 'center',
    marginRight: 12,
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  dateMonth: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  inspectionContent: {
    flex: 1,
  },
  inspectionBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  inspectionNotes: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  notesText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  photoBadgeText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  photoThumbnails: {
    marginVertical: 8,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 6,
    backgroundColor: '#f3f4f6',
  },
  morePhotos: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
});
