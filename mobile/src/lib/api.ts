import * as SecureStore from 'expo-secure-store';
import { getFilename } from './imageUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

class ApiClient {
  private baseUrl: string;
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('accessToken');
    } catch {
      return null;
    }
  }

  private async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync('accessToken', token);
  }

  private async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('refreshToken');
    } catch {
      return null;
    }
  }

  private async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync('refreshToken', token);
  }

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json();

    if (!response.ok) {
      throw data;
    }

    return data;
  }

  private async refreshToken(): Promise<boolean> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return false;

    this.refreshInFlight = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) return false;

        const data = await response.json();
        await this.setToken(data.data.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  private async request<T>(url: string, init: RequestInit, retry: boolean = true): Promise<ApiResponse<T> | void> {
    const token = await this.getToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (response.status === 204) return;

    if (response.status === 401 && retry) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        return this.request<T>(url, init, false);
      }
      await this.clearTokens();
    }

    return this.handleResponse<T>(response);
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, value);
      });
    }

    return this.request<T>(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }) as Promise<ApiResponse<T>>;
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }) as Promise<ApiResponse<T>>;
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }) as Promise<ApiResponse<T>>;
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T> | void> {
    return this.request<T>(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
    });
  }

  // Auth helpers for storing tokens
  async saveAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.setToken(accessToken);
    await this.setRefreshToken(refreshToken);
  }

  async uploadPhotos(endpoint: string, photoUris: string[], extraFields?: Record<string, string>): Promise<ApiResponse<{ urls: string[] }>> {
    const formData = new FormData();

    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, value);
      }
    }

    for (const uri of photoUris) {
      const filename = getFilename(uri);
      // React Native FormData format
      formData.append('files', {
        uri: uri,
        type: 'image/jpeg',
        name: filename,
      } as unknown as Blob);
    }

    return this.request<{ urls: string[] }>(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      body: formData,
    }) as Promise<ApiResponse<{ urls: string[] }>>;
  }
}

export const api = new ApiClient(API_URL);

// Auth API
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post<{
      user: { id: string; email: string; name: string };
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', data),

  register: (data: { email: string; password: string; name: string }) =>
    api.post<{
      user: { id: string; email: string; name: string };
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', data),

  me: () =>
    api.get<{
      id: string;
      email: string;
      name: string;
      phone?: string;
    }>('/auth/me'),

  logout: () => api.post('/auth/logout'),
};

// Apiaries API
export const apiariesApi = {
  list: () =>
    api.get<Array<{
      id: string;
      name: string;
      description?: string;
      location: { name?: string; lat?: number; lng?: number };
      hiveCount: number;
      stats: { healthy: number; warning: number; critical: number };
    }>>('/apiaries'),

  get: (id: string) =>
    api.get<{
      id: string;
      name: string;
      description?: string;
      location: { name?: string; lat?: number; lng?: number };
      hives: Array<{
        id: string;
        hiveNumber: string;
        status: string;
        strength?: string;
      }>;
    }>(`/apiaries/${id}`),
};

// Hives API
export const hivesApi = {
  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      hiveNumber: string;
      qrCode?: string;
      apiary: { id: string; name: string };
      status: string;
      strength?: string;
    }>>('/hives', params),

  get: (id: string) => api.get(`/hives/${id}`),

  getByQr: (qrCode: string) => api.get(`/hives/qr/${qrCode}`),
};

// Inspections API
export const inspectionsApi = {
  create: (data: {
    hiveId: string;
    inspectionDate: string;
    weather?: { temperature?: number; windSpeed?: number; condition?: string };
    assessment?: { strength?: string; temperament?: string; queenSeen?: boolean; queenLaying?: boolean };
    frames?: { brood?: number; honey?: number; pollen?: number; empty?: number };
    health?: { status?: string; varroaLevel?: string; diseases?: string[]; pests?: string[] };
    actions?: Array<{ actionType: string }>;
    notes?: string;
  }) => api.post<{ id: string }>('/inspections', data),

  uploadPhotos: (inspectionId: string, hiveId: string, photoUris: string[]) =>
    api.uploadPhotos(`/photos/upload`, photoUris, { inspectionId, hiveId }),
};

// Treatments API
export const treatmentsApi = {
  create: (data: {
    hiveId: string;
    treatmentDate: string;
    productName: string;
    productType?: string;
    target?: string;
    dosage?: string;
    startDate: string;
    endDate?: string;
    withholdingPeriodDays?: number;
    notes?: string;
  }) => api.post<{ id: string }>('/treatments', data),

  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      hive: { id: string; hiveNumber: string; apiaryName: string };
      treatmentDate: string;
      productName: string;
      target?: string;
      withholdingEndDate?: string;
    }>>('/treatments', params),
};

// Feedings API
export const feedingsApi = {
  create: (data: {
    hiveId: string;
    feedingDate: string;
    feedType: string;
    amountKg: number;
    sugarConcentration?: number;
    reason?: string;
    notes?: string;
  }) => api.post<{ id: string }>('/feedings', data),

  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      hive: { id: string; hiveNumber: string; apiaryName: string };
      feedingDate: string;
      feedType: string;
      amountKg: number;
    }>>('/feedings', params),
};

// Production API
export const productionApi = {
  create: (data: {
    hiveId?: string;
    apiaryId?: string;
    harvestDate: string;
    productType: string;
    honeyType?: string;
    amountKg: number;
    qualityGrade?: string;
    moistureContent?: number;
    pricePerKg?: number;
    notes?: string;
  }) => api.post<{ id: string }>('/production', data),

  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      harvestDate: string;
      productType: string;
      amountKg: number;
    }>>('/production', params),
};

// Calendar API
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  endDate?: string;
  eventType: string;
  allDay: boolean;
  color?: string;
  apiary?: { id: string; name: string } | null;
  hive?: { id: string; hiveNumber: string; apiaryName: string } | null;
  notes?: string;
  completed: boolean;
  createdAt: string;
}

export const calendarApi = {
  list: (params?: Record<string, string>) =>
    api.get<Array<CalendarEvent>>('/calendar', params),

  get: (id: string) =>
    api.get<CalendarEvent>(`/calendar/${id}`),

  create: (data: {
    title: string;
    description?: string;
    eventDate: string;
    endDate?: string;
    eventType: string;
    allDay?: boolean;
    apiaryId?: string;
    hiveId?: string;
    notes?: string;
  }) => api.post<{ id: string }>('/calendar', data),

  update: (id: string, data: Partial<{
    title: string;
    description: string | null;
    eventDate: string;
    endDate: string | null;
    eventType: string;
    notes: string | null;
    completed: boolean;
  }>) => api.put(`/calendar/${id}`, data),

  delete: (id: string) => api.delete(`/calendar/${id}`),
};

// Notifications API
export const notificationsApi = {
  registerToken: (data: { token: string; platform: string }) =>
    api.post('/notifications/register-token', data),

  removeToken: () => api.delete('/notifications/token'),

  getSettings: () =>
    api.get<{
      inspectionReminders: boolean;
      treatmentReminders: boolean;
      weatherAlerts: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
    }>('/notifications/settings'),

  updateSettings: (data: {
    inspectionReminders?: boolean;
    treatmentReminders?: boolean;
    weatherAlerts?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
  }) => api.put('/notifications/settings', data),
};

// Weather API (YR.no/met.no integration)
export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection?: number;
  humidity?: number;
  precipitation?: number;
  cloudCover?: number;
  condition: string;
  conditionCode: string;
  updatedAt: string;
  location: { lat: number; lng: number };
  cached?: boolean;
  stale?: boolean;
}

export interface WeatherForecast {
  date: string;
  temperature: number;
  windSpeed: number;
  condition: string;
  conditionCode: string;
}

export const weatherApi = {
  current: (lat: number, lng: number) =>
    api.get<WeatherData>('/weather/current', {
      lat: lat.toString(),
      lng: lng.toString(),
    }),

  forecast: (lat: number, lng: number) =>
    api.get<{
      location: { lat: number; lng: number };
      forecast: WeatherForecast[];
      updatedAt: string;
    }>('/weather/forecast', {
      lat: lat.toString(),
      lng: lng.toString(),
    }),
};
