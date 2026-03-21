import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { calendarApi, CalendarEvent } from '../../lib/api';

const eventTypes: Record<string, { label: string; color: string; icon: string }> = {
  visit: { label: 'Bigårdbesøk', color: '#3b82f6', icon: 'location-outline' },
  feeding: { label: 'Foring', color: '#22c55e', icon: 'water-outline' },
  queen_breeding: { label: 'Dronningavl', color: '#a855f7', icon: 'flower-outline' },
  treatment: { label: 'Behandling', color: '#ef4444', icon: 'medkit-outline' },
  harvest: { label: 'Honninghøsting', color: '#f59e0b', icon: 'cube-outline' },
  meeting: { label: 'Møte', color: '#6366f1', icon: 'people-outline' },
  other: { label: 'Annet', color: '#6b7280', icon: 'ellipsis-horizontal-outline' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('nb-NO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function CalendarScreen() {
  const queryClient = useQueryClient();

  // Fetch next 60 days of events
  const startDate = new Date().toISOString();
  const endDateObj = new Date();
  endDateObj.setDate(endDateObj.getDate() + 60);
  const endDate = endDateObj.toISOString();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['calendar', 'upcoming'],
    queryFn: () => calendarApi.list({ startDate, endDate }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (id: string) =>
      calendarApi.update(id, { completed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const events = (data?.data || []) as CalendarEvent[];

  const handleDelete = (event: CalendarEvent) => {
    Alert.alert(
      'Slett hendelse',
      `Er du sikker på at du vil slette "${event.title}"?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(event.id),
        },
      ]
    );
  };

  const handleToggleComplete = (event: CalendarEvent) => {
    toggleCompleteMutation.mutate(event.id);
  };

  const renderEvent = ({ item }: { item: CalendarEvent }) => {
    const typeInfo = eventTypes[item.eventType] || eventTypes.other;

    return (
      <TouchableOpacity
        style={[styles.card, item.completed && styles.cardCompleted]}
        activeOpacity={0.7}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.cardRow}>
          <TouchableOpacity
            onPress={() => handleToggleComplete(item)}
            style={styles.checkButton}
          >
            <Ionicons
              name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={item.completed ? '#22c55e' : '#d1d5db'}
            />
          </TouchableOpacity>

          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View
                style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}
              >
                <Ionicons
                  name={typeInfo.icon as any}
                  size={14}
                  color={typeInfo.color}
                />
                <Text style={[styles.typeLabel, { color: typeInfo.color }]}>
                  {typeInfo.label}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.eventTitle,
                item.completed && styles.eventTitleCompleted,
              ]}
            >
              {item.title}
            </Text>

            <View style={styles.eventMeta}>
              <Ionicons name="calendar-outline" size={14} color="#6b7280" />
              <Text style={styles.eventDate}>{formatDate(item.eventDate)}</Text>
            </View>

            {item.apiary && (
              <View style={styles.eventMeta}>
                <Ionicons name="location-outline" size={14} color="#6b7280" />
                <Text style={styles.eventDate}>{item.apiary.name}</Text>
              </View>
            )}

            {item.hive && (
              <View style={styles.eventMeta}>
                <Ionicons name="cube-outline" size={14} color="#6b7280" />
                <Text style={styles.eventDate}>
                  Kube {item.hive.hiveNumber}
                </Text>
              </View>
            )}

            {item.notes && (
              <Text style={styles.eventNotes} numberOfLines={2}>
                {item.notes}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Laster kalender...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/calendar/new')}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Ny hendelse</Text>
      </TouchableOpacity>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
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
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Ingen kommende hendelser</Text>
            <Text style={styles.emptyText}>
              Trykk på "Ny hendelse" for å planlegge aktiviteter
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
  addButton: {
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
  addButtonText: {
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
  cardCompleted: {
    opacity: 0.6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkButton: {
    marginRight: 12,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  eventTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  eventNotes: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
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
