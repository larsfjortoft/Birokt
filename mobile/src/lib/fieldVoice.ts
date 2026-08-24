import { API_URL } from './api';

export interface FieldVoiceContext {
  sessionId: string;
  apiaryName?: string;
}

export interface FieldVoiceResponse {
  transcript: string;
  replyText: string;
  replyAudioBase64?: string;
  replyAudioMime?: string;
  sessionId: string;
}

const DEFAULT_FIELD_VOICE_URL = (() => {
  try {
    const api = new URL(API_URL);
    api.port = '9100';
    api.pathname = '';
    api.search = '';
    api.hash = '';
    return api.toString().replace(/\/$/, '');
  } catch {
    return 'http://10.0.0.16:9100';
  }
})();

export const FIELD_VOICE_URL =
  process.env.EXPO_PUBLIC_FIELD_VOICE_URL ?? DEFAULT_FIELD_VOICE_URL;

export async function sendFieldVoiceClip(
  audioUri: string,
  context: FieldVoiceContext
): Promise<FieldVoiceResponse> {
  const form = new FormData();
  form.append('context', JSON.stringify(context));
  form.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: `field-${Date.now()}.m4a`,
  } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${FIELD_VOICE_URL}/voice`, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    throw new Error(`Kunne ikke na feltmodus-serveren pa ${FIELD_VOICE_URL}. Sjekk Wi-Fi/Tailscale.`);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Feltmodus kunne ikke sende lydklippet.');
  }

  return data;
}
