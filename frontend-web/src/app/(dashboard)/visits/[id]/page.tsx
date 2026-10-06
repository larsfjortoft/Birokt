'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { visitsApi, hivesApi, FieldVisit, VisitEntry } from '@/lib/api';
import { visitStatusLabel } from '@/lib/visitLabels';

const fieldClass = 'w-full rounded-lg border p-2 bg-white';
function BoolField({ label, value, change }: { label: string; value: boolean | null | undefined; change: (v: boolean | null) => void }) {
  return <label className="block text-sm">{label}<select className={fieldClass} value={value == null ? '' : String(value)} onChange={e => change(e.target.value === '' ? null : e.target.value === 'true')}><option value="">Ukjent / ikke undersøkt</option><option value="true">Ja</option><option value="false">Nei</option></select></label>;
}
function EntryEditor({ entry, visit, hives, changed }: { entry: VisitEntry; visit: FieldVisit; hives: Array<{ id: string; hiveNumber: string }>; changed: () => void }) {
  const [kind, setKind] = useState(entry.kind);
  const [hiveId, setHiveId] = useState(entry.hiveId || '');
  const [payload, setPayload] = useState(entry.payload);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const accepted = entry.state === 'accepted';
  const run = async (work: () => Promise<unknown>) => { setBusy(true); setError(''); try { await work(); changed(); } catch (e: any) { setError(e?.error?.message || e?.message || 'Kunne ikke lagre registreringen.'); } finally { setBusy(false); } };
  const change = (field: string, value: unknown) => setPayload(p => ({ ...p, [field]: value }));
  const nested = (section: string, field: string, value: unknown) => setPayload(p => ({ ...p, [section]: { ...p[section], [field]: value } }));
  const save = async (state: 'pending' | 'rejected' | 'accepted') => {
    const data = { kind, hiveId: hiveId || null, payload, version: entry.version, state };
    if (entry.id === 'new') await visitsApi.addEntry(visit.id, { ...data, sourceText: '' });
    else await visitsApi.editEntry(visit.id, entry.id, data);
  };
  const same = kind === entry.kind && hiveId === (entry.hiveId || '') && JSON.stringify(payload) === JSON.stringify(entry.payload);
  return <div className="rounded-xl border bg-white p-5 space-y-4">
    <div className="flex justify-between gap-3"><strong>{entry.origin === 'manual' ? 'Lagt til på PC' : entry.origin === 'corrected' ? 'Rettet på PC' : 'Forslag fra Hermes'}</strong><span>{accepted ? 'Registrert' : entry.state === 'rejected' ? 'Avvist' : 'Avventer godkjenning'}</span></div>
    {entry.sourceText && <blockquote className="border-l-4 border-honey-400 bg-honey-50 p-3 whitespace-pre-wrap">{entry.sourceText}</blockquote>}
    <fieldset disabled={busy} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Type<select disabled={accepted} value={kind} onChange={e => setKind(e.target.value as VisitEntry['kind'])} className={fieldClass}><option value="inspection">Observasjon / inspeksjon</option><option value="feeding">Utført fôring</option><option value="followup">Oppfølging / plan</option><option value="clarification">Må avklares</option></select></label>
        <label className="text-sm">Kube<select value={hiveId} onChange={e => setHiveId(e.target.value)} className={fieldClass}><option value="">Uavklart kube</option>{hives.map(h => <option key={h.id} value={h.id}>{h.hiveNumber}</option>)}</select></label>
      </div>
      {(kind === 'inspection' || kind === 'feeding') && <label className="block text-sm">Hendelsestid<input type="datetime-local" className={fieldClass} value={localDate(payload[kind === 'feeding' ? 'feedingDate' : 'inspectionDate'])} onChange={e => change(kind === 'feeding' ? 'feedingDate' : 'inspectionDate', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>}
      {kind === 'inspection' && <>
        <div className="grid gap-4 sm:grid-cols-2"><BoolField label="Dronning faktisk sett" value={payload.assessment?.queenSeen} change={v => nested('assessment', 'queenSeen', v)} /><BoolField label="Egglegging undersøkt" value={payload.assessment?.queenLaying} change={v => nested('assessment', 'queenLaying', v)} /></div>
        <div className="grid gap-4 sm:grid-cols-3">{([
          ['strength', 'Bistyrke', [['weak', 'Svak'], ['medium', 'Middels'], ['strong', 'Sterk']]],
          ['temperament', 'Gemytt', [['calm', 'Rolig'], ['nervous', 'Urolig'], ['aggressive', 'Aggressiv']]],
          ['status', 'Helse vurdert', [['healthy', 'Ingen avvik ved undersøkelsen'], ['warning', 'Avvik'], ['critical', 'Kritisk']]],
        ] as const).map(([field, label, options]) => <label key={field} className="text-sm">{label}<select className={fieldClass} value={payload[field === 'status' ? 'health' : 'assessment']?.[field] ?? ''} onChange={e => nested(field === 'status' ? 'health' : 'assessment', field, e.target.value || null)}><option value="">Ukjent / ikke undersøkt</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div>
        <div className="grid gap-4 sm:grid-cols-4">{[['brood', 'Yngelrammer'], ['honey', 'Honningrammer'], ['pollen', 'Pollenrammer'], ['empty', 'Tomme rammer']].map(([field, label]) => <label key={field} className="text-sm">{label}<input type="number" min="0" step="1" placeholder="Ukjent" className={fieldClass} value={payload.frames?.[field] ?? ''} onChange={e => nested('frames', field, e.target.value === '' ? null : Number(e.target.value))} /></label>)}</div>
      </>}
      {kind === 'feeding' && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Fôrtype<select className={fieldClass} value={payload.feedType || ''} onChange={e => change('feedType', e.target.value)}><option value="">Velg type</option>{[['sugar_syrup', 'Sukkerlake'], ['sugar_dough', 'Sukkerdeig'], ['fondant', 'Fondant'], ['ready_feed', 'Ferdigfôr'], ['pollen_patty', 'Pollenkake'], ['pollen_substitute', 'Pollenerstatning'], ['honey', 'Honning'], ['other', 'Annet']].map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label><label className="text-sm">Faktisk mengde (kg)<input type="number" min="0.001" step="any" className={fieldClass} value={payload.amountKg ?? ''} onChange={e => change('amountKg', e.target.value === '' ? null : Number(e.target.value))} /></label></div>}
      {kind === 'followup' && <><label className="block text-sm">Oppgave<input className={fieldClass} value={payload.title || ''} onChange={e => change('title', e.target.value)} /></label><label className="block text-sm">Planlagt tidspunkt (trengs for kalenderføring)<input type="datetime-local" className={fieldClass} value={localDate(payload.dueAt)} onChange={e => change('dueAt', e.target.value ? new Date(e.target.value).toISOString() : null)} /></label></>}
      <label className="block text-sm">Notater / avklaring<textarea rows={3} className={fieldClass} value={payload.notes || ''} onChange={e => change('notes', e.target.value)} /></label>
    </fieldset>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {<div className="flex flex-wrap gap-3">
      <button disabled={busy} className="rounded-lg border px-4 py-2" onClick={() => run(() => save(accepted ? 'accepted' : 'pending'))}>Lagre {entry.id === 'new' ? 'tillegg' : 'rettelse'}</button>
      {entry.id !== 'new' && entry.state === 'pending' && <><button disabled={busy || !same || kind === 'clarification' || !hiveId} className="rounded-lg bg-honey-500 px-4 py-2 disabled:opacity-40" onClick={() => run(() => visitsApi.acceptEntry(visit.id, entry))}>Godkjenn og registrer</button><button disabled={busy} className="rounded-lg border px-4 py-2" onClick={() => run(() => save('rejected'))}>Avvis forslag</button></>}
      {!same && <p className="text-sm text-gray-600">Lagre rettelsen før godkjenning.</p>}
    </div>}
    {accepted && entry.entityId && <p className="text-sm">Registreringen har kildekobling til dette besøket. <Link className="underline" href={kind === 'inspection' ? `/inspections/${entry.entityId}` : kind === 'feeding' ? '/feedings' : '/calendar'}>Åpne registreringen</Link></p>}
  </div>;
}
function localDate(date?: string) { if (!date || !Number.isFinite(Date.parse(date))) return ''; const d = new Date(date); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }

export default function VisitPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [audioUrl, setAudioUrl] = useState('');
  const [audioError, setAudioError] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const { data, isLoading, isError } = useQuery({ queryKey: ['visit', id], queryFn: () => visitsApi.get(id), refetchInterval: query => ['queued', 'processing'].includes(query.state.data?.data?.status || '') ? 5000 : false });
  const { data: hiveData } = useQuery({ queryKey: ['hives', 'visit', id], queryFn: () => hivesApi.list({ apiaryId: data!.data!.apiaryId, perPage: '100' }), enabled: !!data?.data });
  const visit = data?.data;
  const reload = () => { setAdding(false); void queryClient.invalidateQueries({ queryKey: ['visit', id] }); void queryClient.invalidateQueries({ queryKey: ['visits'] }); };
  useEffect(() => { setReviewNotes(visit?.reviewNotes || ''); }, [visit?.reviewNotes]);
  useEffect(() => {
    if (!visit?.audioReceived) return;
    let cancelled = false; let url = '';
    visitsApi.audio(id).then(blob => { if (!cancelled) { url = URL.createObjectURL(blob); setAudioUrl(url); } }).catch(() => setAudioError('Opptaket kunne ikke lastes. Prøv å åpne besøket igjen.'));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [id, visit?.audioReceived]);
  const run = async (work: () => Promise<unknown>) => { setError(''); try { await work(); reload(); } catch (e: any) { setError(e?.error?.message || 'Kunne ikke oppdatere besøket.'); } };
  if (isLoading) return <p>Laster besøk …</p>;
  if (isError || !visit) return <p className="text-red-700">Besøket kunne ikke lastes. Kontroller forbindelsen.</p>;
  const pending = visit.entries?.filter(e => e.state === 'pending').length || 0;
  return <div className="max-w-5xl space-y-6">
    <Link className="underline" href="/visits">← Alle besøk</Link>
    <h1 className="text-3xl font-bold">{visit.apiaryName}</h1>
    <p>{new Date(visit.startedAt).toLocaleString('nb-NO')} · {visitStatusLabel(visit.status)} · {visit.reviewedAt ? 'Gjennomgått' : 'Ikke gjennomgått'}</p>
    {visit.interrupted && <p className="rounded-xl bg-amber-50 p-4 text-amber-800">Opptaket ble avbrutt. Det kan mangle deler av besøket.</p>}
    {visit.lastError && <div className="rounded-xl bg-red-50 p-4 text-red-800"><p>{visit.lastError}</p>{visit.status === 'failed' && <button className="underline mt-2" onClick={() => run(() => visitsApi.retry(id))}>Prøv behandling igjen</button>}</div>}
    {visit.audioReceived && <section className="rounded-xl border bg-white p-5 space-y-3"><h2 className="text-xl font-semibold">Opptak fra besøket</h2>{audioUrl ? <audio controls src={audioUrl} className="w-full" /> : <p>{audioError || 'Laster lyd …'}</p>}</section>}
    {visit.summary && <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold text-xl">Hermes sin oppsummering</h2><p className="whitespace-pre-wrap mt-3">{visit.summary}</p></section>}
    {visit.transcript && <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">Original transkripsjon</summary><p className="whitespace-pre-wrap mt-4">{visit.transcript}</p></details>}
    <div className="flex justify-between"><h2 className="text-2xl font-semibold">Registreringer · {pending} uavklarte</h2><button onClick={() => setAdding(!adding)} className="rounded-lg border bg-white px-4 py-2">Legg til på PC</button></div>
    {adding && <EntryEditor key="new" entry={{ id: 'new', visitId: id, kind: 'inspection', hiveId: null, sourceText: '', payload: { inspectionDate: visit.startedAt }, state: 'pending', origin: 'manual', version: 1 }} visit={visit} hives={hiveData?.data || []} changed={reload} />}
    {visit.entries?.map(entry => <EntryEditor key={`${entry.id}:${entry.version}`} entry={entry} visit={visit} hives={hiveData?.data || []} changed={reload} />)}
    {visit.status === 'ready' && !visit.entries?.length && <p>Ingen strukturerte registreringer i opptaket. Du kan supplere manuelt.</p>}
    <section className="rounded-xl border bg-white p-5 space-y-4"><h2 className="text-xl font-semibold">Gjennomgang</h2><p>Gjennomgått betyr at du har sett besøket. Uavklarte forslag blir fortsatt stående åpne.</p><textarea className={fieldClass} placeholder="Merknader fra etterarbeidet" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} /><button className="rounded-lg bg-honey-500 px-4 py-2" onClick={() => run(() => visitsApi.review(id, { version: visit.version, reviewed: !visit.reviewedAt, notes: reviewNotes }))}>{visit.reviewedAt ? 'Åpne gjennomgang igjen' : 'Lagre og marker gjennomgått'}</button><button className="rounded-lg border px-4 py-2 ml-3" onClick={() => run(() => visitsApi.review(id, { version: visit.version, reviewed: !!visit.reviewedAt, notes: reviewNotes }))}>Lagre merknader</button></section>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
