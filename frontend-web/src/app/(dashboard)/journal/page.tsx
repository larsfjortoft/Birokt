'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Plus, Search, Filter, Calendar, Thermometer, Tag, Pencil, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { journalApi, JournalEntry } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIES = [
  { value: 'general', label: 'Generelt', color: 'bg-gray-100 text-gray-700' },
  { value: 'weather', label: 'V\u00e6r', color: 'bg-blue-100 text-blue-700' },
  { value: 'bloom', label: 'Blomstring', color: 'bg-pink-100 text-pink-700' },
  { value: 'bees', label: 'Bier', color: 'bg-amber-100 text-amber-700' },
  { value: 'harvest', label: 'H\u00f8sting', color: 'bg-green-100 text-green-700' },
  { value: 'observation', label: 'Observasjon', color: 'bg-purple-100 text-purple-700' },
  { value: 'other', label: 'Annet', color: 'bg-slate-100 text-slate-700' },
];

const MOODS = [
  { value: 'positive', label: 'Positivt', emoji: '\u2600\ufe0f' },
  { value: 'neutral', label: 'N\u00f8ytralt', emoji: '\u26c5' },
  { value: 'negative', label: 'Negativt', emoji: '\ud83c\udf27\ufe0f' },
];

function getCategoryInfo(value: string) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[0];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('nb-NO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function JournalPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const currentCategory = searchParams.get('category') || '';
  const currentSearch = searchParams.get('search') || '';

  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formMood, setFormMood] = useState('');
  const [formTemperature, setFormTemperature] = useState('');
  const [formTags, setFormTags] = useState('');

  const params: Record<string, string> = {};
  if (currentCategory) params.category = currentCategory;
  if (currentSearch) params.search = currentSearch;

  const { data: response, isLoading } = useQuery({
    queryKey: ['journal', currentCategory, currentSearch],
    queryFn: () => journalApi.list(params),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof journalApi.create>[0]) => journalApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      toast.success('Journalinnlegg opprettet');
      closeModal();
    },
    onError: () => toast.error('Kunne ikke opprette innlegg'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof journalApi.update>[1] }) =>
      journalApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      toast.success('Innlegg oppdatert');
      closeModal();
    },
    onError: () => toast.error('Kunne ikke oppdatere innlegg'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => journalApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      toast.success('Innlegg slettet');
      setDeleteId(null);
    },
    onError: () => toast.error('Kunne ikke slette innlegg'),
  });

  function updateFilters(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function openCreateModal() {
    setEditEntry(null);
    const today = new Date().toISOString().split('T')[0];
    setFormDate(today);
    setFormTitle('');
    setFormContent('');
    setFormCategory('general');
    setFormMood('');
    setFormTemperature('');
    setFormTags('');
    setShowModal(true);
  }

  function openEditModal(entry: JournalEntry) {
    setEditEntry(entry);
    setFormDate(new Date(entry.entryDate).toISOString().split('T')[0]);
    setFormTitle(entry.title || '');
    setFormContent(entry.content);
    setFormCategory(entry.category);
    setFormMood(entry.mood || '');
    setFormTemperature(entry.temperature?.toString() || '');
    setFormTags(entry.tags.join(', '));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditEntry(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tags = formTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const data = {
      entryDate: new Date(formDate).toISOString(),
      title: formTitle || undefined,
      content: formContent,
      category: formCategory as 'general',
      tags,
      mood: (formMood || undefined) as 'positive' | 'neutral' | 'negative' | undefined,
      temperature: formTemperature ? parseFloat(formTemperature) : undefined,
    };

    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateFilters('search', searchInput);
  }

  const entries = response?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal</h1>
          <p className="text-gray-500 mt-1">Dine notater og observasjoner gjennom sesongen</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nytt innlegg
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="S\u00f8k i journal..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary">
                <Search className="w-4 h-4" />
              </Button>
            </form>
            <select
              value={currentCategory}
              onChange={(e) => updateFilters('category', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500 focus:border-honey-500"
            >
              <option value="">Alle kategorier</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Entries list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-1/3 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-5xl mb-4">📓</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen journalinnlegg enn\u00e5</h3>
            <p className="text-gray-500 mb-4">
              Begynn \u00e5 notere observasjoner, v\u00e6r, blomstring og andre hendelser gjennom sesongen.
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Skriv f\u00f8rste innlegg
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const cat = getCategoryInfo(entry.category);
            const isExpanded = expandedId === entry.id;
            const isLong = entry.content.length > 200;

            return (
              <Card key={entry.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Date and category */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(entry.entryDate)}
                        </span>
                        <Badge className={cat.color}>{cat.label}</Badge>
                        {entry.mood && (
                          <span className="text-sm">
                            {MOODS.find(m => m.value === entry.mood)?.emoji}
                          </span>
                        )}
                        {entry.temperature !== undefined && entry.temperature !== null && (
                          <span className="text-sm text-gray-500 flex items-center gap-0.5">
                            <Thermometer className="w-3.5 h-3.5" />
                            {entry.temperature}\u00b0C
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      {entry.title && (
                        <h3 className="font-semibold text-gray-900 mb-1">{entry.title}</h3>
                      )}

                      {/* Content */}
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {isLong && !isExpanded
                          ? entry.content.slice(0, 200) + '...'
                          : entry.content}
                      </p>
                      {isLong && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="text-sm text-honey-600 hover:text-honey-700 mt-1 flex items-center gap-1"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          {isExpanded ? 'Vis mindre' : 'Les mer'}
                        </button>
                      )}

                      {/* Tags */}
                      {entry.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <Tag className="w-3 h-3 text-gray-400" />
                          {entry.tags.map((tag, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(entry)}
                        className="p-2 text-gray-400 hover:text-honey-600 hover:bg-honey-50 rounded-lg transition-colors"
                        title="Rediger"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(entry.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Slett"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={editEntry ? 'Rediger innlegg' : 'Nytt journalinnlegg'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Dato"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
            <Input
              label="Tittel (valgfritt)"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="F.eks. F\u00f8rste v\u00e5rblomster"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Innhold</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={5}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500 focus:border-honey-500 resize-y"
              placeholder="Skriv dine observasjoner, tanker og refleksjoner..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500 focus:border-honey-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stemning</label>
              <select
                value={formMood}
                onChange={(e) => setFormMood(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500 focus:border-honey-500"
              >
                <option value="">Velg stemning...</option>
                {MOODS.map(m => (
                  <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
                ))}
              </select>
            </div>

            <Input
              label="Temperatur (\u00b0C)"
              type="number"
              step="0.1"
              value={formTemperature}
              onChange={(e) => setFormTemperature(e.target.value)}
              placeholder="F.eks. 15"
            />
          </div>

          <Input
            label="Tagger (kommaseparert)"
            value={formTags}
            onChange={(e) => setFormTags(e.target.value)}
            placeholder="F.eks. hassel, pollen, v\u00e5rtegn"
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Avbryt
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editEntry ? 'Oppdater' : 'Opprett'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Slett innlegg" size="sm">
        <p className="text-gray-600 mb-6">Er du sikker p\u00e5 at du vil slette dette journalinnlegget? Dette kan ikke angres.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Avbryt
          </Button>
          <Button
            variant="danger"
            isLoading={deleteMutation.isPending}
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
          >
            Slett
          </Button>
        </div>
      </Modal>
    </div>
  );
}
