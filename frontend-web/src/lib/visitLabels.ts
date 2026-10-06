export function visitStatusLabel(status: string) {
  return ({ awaiting_audio: 'Venter på opptak', queued: 'Mottatt – venter på Hermes', processing: 'Hermes behandler', ready: 'Klar til gjennomgang', failed: 'Behandling feilet' } as Record<string, string>)[status] || 'Ukjent status';
}
