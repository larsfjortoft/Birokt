'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Box, ClipboardCheck, Syringe, Crown, Loader2 } from 'lucide-react';
import { searchApi, SearchResults } from '@/lib/api';
import { cn } from '@/lib/utils';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type ResultItem =
  | { type: 'hive'; id: string; label: string; sub: string; href: string }
  | { type: 'inspection'; id: string; label: string; sub: string; href: string }
  | { type: 'treatment'; id: string; label: string; sub: string; href: string }
  | { type: 'queen'; id: string; label: string; sub: string; href: string };

function buildItems(data: SearchResults): ResultItem[] {
  const items: ResultItem[] = [];

  for (const h of data.results.hives) {
    items.push({
      type: 'hive',
      id: h.id,
      label: `Kube ${h.hiveNumber}`,
      sub: h.apiaryName,
      href: `/hives/${h.id}`,
    });
  }

  for (const i of data.results.inspections) {
    const date = new Date(i.inspectionDate).toLocaleDateString('nb-NO');
    items.push({
      type: 'inspection',
      id: i.id,
      label: `Inspeksjon ${date}`,
      sub: `Kube ${i.hiveNumber} · ${i.apiaryName}`,
      href: `/inspections/${i.id}`,
    });
  }

  for (const t of data.results.treatments) {
    items.push({
      type: 'treatment',
      id: t.id,
      label: t.productName,
      sub: `Kube ${t.hiveNumber} · ${t.apiaryName}`,
      href: `/treatments`,
    });
  }

  for (const q of data.results.queens) {
    items.push({
      type: 'queen',
      id: q.id,
      label: q.queenCode,
      sub: q.hiveNumber ? `Kube ${q.hiveNumber} · ${q.apiaryName}` : q.status,
      href: `/queens/${q.id}`,
    });
  }

  return items;
}

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  hive: Box,
  inspection: ClipboardCheck,
  treatment: Syringe,
  queen: Crown,
};

const typeLabel: Record<string, string> = {
  hive: 'Kuber',
  inspection: 'Inspeksjoner',
  treatment: 'Behandlinger',
  queen: 'Dronninger',
};

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      const res = await searchApi.search(debouncedQuery, 5);
      return res.data as SearchResults;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const items = data ? buildItems(data) : [];
  const hasResults = items.length > 0;
  const showDropdown = open && debouncedQuery.length >= 2;

  const handleSelect = useCallback(
    (href: string) => {
      router.push(href);
      setQuery('');
      setOpen(false);
    },
    [router]
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Group items by type preserving order
  const grouped = items.reduce<Record<string, ResultItem[]>>((acc, item) => {
    (acc[item.type] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Søk..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg z-50 overflow-hidden">
          {isFetching && !hasResults && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Søker...
            </div>
          )}

          {!isFetching && !hasResults && debouncedQuery.length >= 2 && (
            <div className="py-6 text-center text-sm text-gray-500">
              Ingen resultater for &quot;{debouncedQuery}&quot;
            </div>
          )}

          {hasResults && (
            <div className="max-h-80 overflow-y-auto py-1">
              {Object.entries(grouped).map(([type, groupItems]) => {
                const Icon = typeIcon[type];
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      {typeLabel[type]}
                    </div>
                    {groupItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.href)}
                        className={cn(
                          'w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors flex flex-col gap-0.5'
                        )}
                      >
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                        <span className="text-xs text-gray-500">{item.sub}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
