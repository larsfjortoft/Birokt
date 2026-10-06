'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { visitsApi } from '@/lib/api';
import { visitStatusLabel } from '@/lib/visitLabels';
export default function VisitsPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['visits'], queryFn: visitsApi.list, refetchInterval: 10000 });
  return <div className="max-w-5xl space-y-6">
    <h1 className="text-3xl font-bold">Besøk i bigården</h1>
    <p className="text-gray-600">Gjennomgå opptak, avklar usikkerheter og godkjenn registreringene fra besøket.</p>
    {isLoading && <p>Laster besøk …</p>}
    {isError && <p className="text-red-700">Besøkene kunne ikke lastes. Kontroller forbindelsen til Birøkt.</p>}
    {!isLoading && !isError && data?.data?.length === 0 && <p>Ingen besøk ennå. Start et opptak i telefonens Felt-fane.</p>}
    <div className="grid gap-4">{data?.data?.map(visit => <Link key={visit.id} href={`/visits/${visit.id}`} className="rounded-xl border bg-white p-5 hover:border-honey-500">
      <div className="flex justify-between gap-4"><h2 className="text-xl font-semibold">{visit.apiaryName}</h2><span>{visitStatusLabel(visit.status)}</span></div>
      <p className="mt-2 text-gray-600">{new Date(visit.startedAt).toLocaleString('nb-NO')} · {visit.reviewedAt ? 'Gjennomgått' : 'Ikke gjennomgått'}</p>
      {visit.interrupted && <p className="mt-2 text-amber-700">Opptaket ble avbrutt. Kontroller at relevante opplysninger er med.</p>}
      {visit.lastError && <p className="mt-2 text-red-700">{visit.lastError}</p>}
    </Link>)}</div>
  </div>;
}
