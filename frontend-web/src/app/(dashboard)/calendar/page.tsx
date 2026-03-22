'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi, apiariesApi, hivesApi, CalendarEvent } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Circle,
  MapPin,
  Box,
  RefreshCw,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Apiary {
  id: string;
  name: string;
}

interface Hive {
  id: string;
  hiveNumber: string;
  apiary: { id: string; name: string };
}

const eventTypes = [
  { value: 'visit', label: 'Bigårdbesøk', color: '#3b82f6' },
  { value: 'feeding', label: 'Foring', color: '#22c55e' },
  { value: 'queen_breeding', label: 'Dronningavl', color: '#a855f7' },
  { value: 'treatment', label: 'Behandling', color: '#ef4444' },
  { value: 'harvest', label: 'Honninghøsting', color: '#f59e0b' },
  { value: 'meeting', label: 'Møte', color: '#6366f1' },
  { value: 'other', label: 'Annet', color: '#6b7280' },
];

function getEventTypeLabel(type: string) {
  return eventTypes.find((t) => t.value === type)?.label || type;
}

function getEventTypeColor(type: string) {
  return eventTypes.find((t) => t.value === type)?.color || '#6b7280';
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  // Convert from Sunday-based (0) to Monday-based (0)
  return day === 0 ? 6 : day - 1;
}

const monthNames = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
];

const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate date range for the visible month
  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const { data: eventsResponse, isLoading } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => calendarApi.list({ startDate, endDate }),
  });

  const { data: apiariesResponse } = useQuery({
    queryKey: ['apiaries'],
    queryFn: () => apiariesApi.list(),
  });

  const { data: hivesResponse } = useQuery({
    queryKey: ['hives'],
    queryFn: () => hivesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (id: string) => calendarApi.toggleComplete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => calendarApi.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const { data: syncStatusResponse } = useQuery({
    queryKey: ['calendar-sync-status'],
    queryFn: () => calendarApi.syncStatus(),
  });
  const googleSyncEnabled = (syncStatusResponse?.data as { enabled: boolean } | undefined)?.enabled ?? false;

  const events = (eventsResponse?.data || []) as CalendarEvent[];
  const apiaries = ((apiariesResponse?.data || []) as unknown as Apiary[]);
  const hives = ((hivesResponse?.data || []) as unknown as Hive[]);

  // Group events by date string (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      const dateStr = new Date(event.eventDate).toISOString().slice(0, 10);
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(event);
    }
    return map;
  }, [events]);

  // Events for selected date
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  // Stats
  const upcomingEvents = events.filter(
    (e) => new Date(e.eventDate) >= new Date() && !e.completed
  ).length;
  const completedEvents = events.filter((e) => e.completed).length;

  // Calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const today = new Date().toISOString().slice(0, 10);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(today);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalender</h1>
          <p className="text-gray-500">Planlegg aktiviteter og hendelser</p>
        </div>
        <div className="flex items-center gap-2">
          {googleSyncEnabled && (
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', syncMutation.isPending && 'animate-spin')} />
              {syncMutation.isPending ? 'Synkroniserer...' : 'Synk Google'}
            </Button>
          )}
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ny hendelse
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CalendarDays className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Hendelser denne måneden</p>
                <p className="text-2xl font-bold">{events.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Circle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Kommende</p>
                <p className="text-2xl font-bold">{upcomingEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Fullført</p>
                <p className="text-2xl font-bold">{completedEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar + Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CardTitle className="text-lg">
                  {monthNames[month]} {year}
                </CardTitle>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday}>
                I dag
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {Array.from({ length: totalCells }).map((_, i) => {
                const dayNum = i - firstDay + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dateStr = isCurrentMonth
                  ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                  : '';
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const dayEvents = dateStr ? (eventsByDate[dateStr] || []) : [];

                return (
                  <button
                    key={i}
                    onClick={() => isCurrentMonth && setSelectedDate(dateStr)}
                    disabled={!isCurrentMonth}
                    className={cn(
                      'bg-white p-2 min-h-[80px] text-left transition-colors relative',
                      isCurrentMonth ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-default',
                      isSelected && 'ring-2 ring-honey-500 ring-inset'
                    )}
                  >
                    {isCurrentMonth && (
                      <>
                        <span
                          className={cn(
                            'text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full',
                            isToday
                              ? 'bg-honey-500 text-white'
                              : 'text-gray-900'
                          )}
                        >
                          {dayNum}
                        </span>
                        {/* Event dots */}
                        {dayEvents.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {dayEvents.slice(0, 3).map((event) => (
                              <div
                                key={event.id}
                                className="w-full truncate text-xs px-1 py-0.5 rounded"
                                style={{
                                  backgroundColor: `${getEventTypeColor(event.eventType)}20`,
                                  color: getEventTypeColor(event.eventType),
                                }}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{dayEvents.length - 3} til
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate
                ? formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Velg en dag'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-gray-400 text-sm text-center py-8">
                Klikk på en dag for å se hendelser
              </p>
            ) : selectedEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Ingen hendelser denne dagen</p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Legg til
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      'p-3 rounded-lg border transition-colors',
                      event.completed ? 'bg-gray-50 border-gray-200' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <button
                          onClick={() => toggleCompleteMutation.mutate(event.id)}
                          className="mt-0.5 flex-shrink-0"
                        >
                          {event.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <h4
                            className={cn(
                              'font-medium text-sm truncate',
                              event.completed ? 'line-through text-gray-400' : 'text-gray-900'
                            )}
                          >
                            {event.title}
                          </h4>
                          <Badge
                            className="mt-1 text-xs"
                            style={{
                              backgroundColor: `${getEventTypeColor(event.eventType)}20`,
                              color: getEventTypeColor(event.eventType),
                            }}
                          >
                            {getEventTypeLabel(event.eventType)}
                          </Badge>
                          {event.apiary && (
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.apiary.name}
                            </p>
                          )}
                          {event.hive && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Box className="w-3 h-3" />
                              Kube {event.hive.hiveNumber}
                            </p>
                          )}
                          {event.notes && (
                            <p className="text-xs text-gray-500 mt-1">{event.notes}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={() => {
                          if (confirm('Er du sikker på at du vil slette denne hendelsen?')) {
                            deleteMutation.mutate(event.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming events list */}
      <Card>
        <CardHeader>
          <CardTitle>Kommende hendelser</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Laster hendelser...</p>
          ) : events.filter((e) => !e.completed).length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen kommende hendelser denne måneden</p>
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Legg til hendelse
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {events
                .filter((e) => !e.completed)
                .map((event) => (
                  <div key={event.id} className="py-4 flex items-start justify-between">
                    <div className="flex gap-4">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: `${getEventTypeColor(event.eventType)}20`,
                        }}
                      >
                        <CalendarDays
                          className="w-5 h-5"
                          style={{ color: getEventTypeColor(event.eventType) }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{event.title}</h3>
                          <Badge
                            style={{
                              backgroundColor: `${getEventTypeColor(event.eventType)}20`,
                              color: getEventTypeColor(event.eventType),
                            }}
                          >
                            {getEventTypeLabel(event.eventType)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{formatDate(event.eventDate)}</span>
                          {event.apiary && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.apiary.name}
                            </span>
                          )}
                          {event.hive && (
                            <span className="flex items-center gap-1">
                              <Box className="w-3 h-3" />
                              Kube {event.hive.hiveNumber}
                            </span>
                          )}
                        </div>
                        {event.notes && (
                          <p className="text-sm text-gray-500 mt-1">{event.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCompleteMutation.mutate(event.id)}
                        title="Merk som fullført"
                      >
                        <CheckCircle2 className="w-4 h-4 text-gray-400 hover:text-green-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Er du sikker på at du vil slette denne hendelsen?')) {
                            deleteMutation.mutate(event.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        apiaries={apiaries}
        hives={hives}
        defaultDate={selectedDate || undefined}
      />
    </div>
  );
}

function CreateEventModal({
  isOpen,
  onClose,
  apiaries,
  hives,
  defaultDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  apiaries: Apiary[];
  hives: Hive[];
  defaultDate?: string;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: defaultDate || new Date().toISOString().slice(0, 10),
    endDate: '',
    eventType: 'visit',
    apiaryId: '',
    hiveId: '',
    notes: '',
  });

  // Update default date when it changes
  const effectiveDate = defaultDate || new Date().toISOString().slice(0, 10);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof calendarApi.create>[0]) =>
      calendarApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
      setFormData({
        title: '',
        description: '',
        eventDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        eventType: 'visit',
        apiaryId: '',
        hiveId: '',
        notes: '',
      });
    },
  });

  // Filter hives by selected apiary
  const filteredHives = formData.apiaryId
    ? hives.filter((h) => h.apiary.id === formData.apiaryId)
    : hives;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.eventDate) return;

    createMutation.mutate({
      title: formData.title,
      description: formData.description || undefined,
      eventDate: new Date(formData.eventDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      eventType: formData.eventType,
      apiaryId: formData.apiaryId || undefined,
      hiveId: formData.hiveId || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ny hendelse" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <Input
          label="Tittel *"
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="F.eks. Besøk bigård nord"
          required
        />

        {/* Event type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type *
          </label>
          <select
            value={formData.eventType}
            onChange={(e) => setFormData((prev) => ({ ...prev, eventType: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
          >
            {eventTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dato *
            </label>
            <input
              type="date"
              value={formData.eventDate || effectiveDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, eventDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sluttdato
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Beskrivelse
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500 resize-none"
            placeholder="Kort beskrivelse av hendelsen..."
          />
        </div>

        {/* Apiary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bigård (valgfritt)
          </label>
          <select
            value={formData.apiaryId}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, apiaryId: e.target.value, hiveId: '' }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
          >
            <option value="">Ingen bigård valgt</option>
            {apiaries.map((apiary) => (
              <option key={apiary.id} value={apiary.id}>
                {apiary.name}
              </option>
            ))}
          </select>
        </div>

        {/* Hive */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kube (valgfritt)
          </label>
          <select
            value={formData.hiveId}
            onChange={(e) => setFormData((prev) => ({ ...prev, hiveId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500"
          >
            <option value="">Ingen kube valgt</option>
            {filteredHives.map((hive) => (
              <option key={hive.id} value={hive.id}>
                Kube {hive.hiveNumber} - {hive.apiary.name}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notater
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500 resize-none"
            placeholder="Tilleggsinformasjon..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Lagrer...' : 'Lagre hendelse'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
