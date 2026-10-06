import { API_URL, api } from './api';
import * as SecureStore from 'expo-secure-store';
export interface VisitStatus {
  id: string;
  status: 'awaiting_audio' | 'queued' | 'processing' | 'ready' | 'failed';
  audioReceived: boolean; audioBytes?: number; lastError?: string;
}
export async function uploadVisitAudio(id: string, uri: string): Promise<VisitStatus> {
  const form = new FormData();
  form.append('audio', { uri, type: 'audio/mp4', name: `${id}.m4a` } as unknown as Blob);
  const token = await SecureStore.getItemAsync('accessToken');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60_000);
  try {
    const response = await fetch(`${API_URL}/visits/${id}/audio`, { method: 'POST', body: form, signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const result = await response.json();
    if (!response.ok || !result.data?.audioReceived) throw new Error(result.error?.message || 'Serveren har ikke bekreftet mottak.');
    return result.data;
  } finally { clearTimeout(timeout); }
}
export const fieldVisitsApi = {
  create: (data: { id: string; apiaryId: string; startedAt: string; endedAt: string; interrupted: boolean }) => api.post<VisitStatus>('/visits', data, data.id),
  get: (id: string) => api.get<VisitStatus>(`/visits/${id}`),
  retry: (id: string) => api.post(`/visits/${id}/retry`),
};
