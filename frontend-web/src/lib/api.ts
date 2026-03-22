const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const BACKEND_URL = API_URL.replace(/\/api\/v\d+$/, '');

/** Resolve a photo URL (which may be relative like /uploads/...) to an absolute URL */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

class ApiClient {
  private baseUrl: string;
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
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

    const refreshToken = localStorage.getItem('refreshToken');
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
        localStorage.setItem('accessToken', data.data.accessToken);
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
    const token = this.getToken();
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

      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
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

  async uploadFiles<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      body: formData,
    }) as Promise<ApiResponse<T>>;
  }
}

export const api = new ApiClient(API_URL);

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string; phone?: string }) =>
    api.post<{
      user: { id: string; email: string; name: string; createdAt: string };
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{
      user: { id: string; email: string; name: string };
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  me: () =>
    api.get<{
      id: string;
      email: string;
      name: string;
      phone?: string;
      avatarUrl?: string;
      settings: Record<string, unknown>;
      createdAt: string;
    }>('/auth/me'),

  updateProfile: (data: { name?: string; phone?: string | null }) =>
    api.put<{
      id: string;
      email: string;
      name: string;
      phone?: string;
    }>('/auth/me', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/me/password', data),

  deleteAccount: () => api.delete('/auth/me'),
};

// Apiaries API
export const apiariesApi = {
  list: (params?: { includeInactive?: string; type?: string }) =>
    api.get<Array<{
      id: string;
      name: string;
      description?: string;
      location: { name?: string; lat?: number; lng?: number };
      type: string;
      active: boolean;
      hiveCount: number;
      stats: { healthy: number; warning: number; critical: number };
      role: string;
      createdAt: string;
    }>>('/apiaries', params as Record<string, string>),

  get: (id: string) =>
    api.get<{
      id: string;
      name: string;
      description?: string;
      location: { name?: string; lat?: number; lng?: number };
      type: string;
      active: boolean;
      hives: Array<{
        id: string;
        hiveNumber: string;
        status: string;
        strength?: string;
        lastInspection?: string;
      }>;
      collaborators: Array<{ userId: string; name: string; role: string }>;
      createdAt: string;
    }>(`/apiaries/${id}`),

  create: (data: {
    name: string;
    description?: string;
    location?: { name?: string; lat?: number; lng?: number };
    type?: string;
  }) => api.post('/apiaries', data),

  update: (id: string, data: Partial<{
    name: string;
    description: string;
    location: { name?: string; lat?: number; lng?: number };
    type: string;
    active: boolean;
  }>) => api.put(`/apiaries/${id}`, data),

  delete: (id: string) => api.delete(`/apiaries/${id}`),
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
      hiveType: string;
      boxCount: number;
      queen: { year?: number; marked: boolean; color?: string; race?: string };
      currentFrames: { brood: number; honey: number };
      lastInspection?: { date: string; healthStatus: string; strength?: string };
      stats: { totalInspections: number; totalProductionKg: number };
      createdAt: string;
    }>>('/hives', params),

  get: (id: string) => api.get(`/hives/${id}`),

  getByQr: (qrCode: string) => api.get(`/hives/qr/${qrCode}`),

  create: (data: {
    apiaryId: string;
    hiveNumber: string;
    hiveType?: string;
    status?: string;
    queen?: { year?: number; marked?: boolean; color?: string; race?: string };
    notes?: string;
  }) => api.post('/hives', data),

  update: (id: string, data: Partial<{
    hiveNumber: string;
    hiveType: string;
    status: string;
    strength: string;
    boxCount: number;
    queen: { year?: number; marked?: boolean; color?: string; race?: string };
    notes: string;
  }>) => api.put(`/hives/${id}`, data),

  delete: (id: string) => api.delete(`/hives/${id}`),
};

// Inspections API
export const inspectionsApi = {
  list: (params?: Record<string, string>) => api.get('/inspections', params),

  get: (id: string) => api.get(`/inspections/${id}`),

  create: (data: {
    hiveId: string;
    inspectionDate: string;
    weather?: { temperature?: number; windSpeed?: number; condition?: string };
    assessment?: { strength?: string; temperament?: string; queenSeen?: boolean; queenLaying?: boolean };
    frames?: { brood?: number; honey?: number; pollen?: number; empty?: number };
    health?: { status?: string; varroaLevel?: string; diseases?: string[]; pests?: string[] };
    actions?: Array<{ actionType: string; details?: Record<string, unknown> }>;
    notes?: string;
  }) => api.post('/inspections', data),

  update: (id: string, data: unknown) => api.put(`/inspections/${id}`, data),

  delete: (id: string) => api.delete(`/inspections/${id}`),
};

// Stats API
export const statsApi = {
  overview: (params?: { year?: string; apiaryId?: string }) =>
    api.get<{
      year: number;
      apiaries: { total: number; active: number };
      hives: {
        total: number;
        active: number;
        nuc: number;
        byStrength: { strong: number; medium: number; weak: number };
        byHealth: { healthy: number; warning: number; critical: number };
      };
      inspections: { total: number; thisMonth: number; avgPerHive: string | number };
      production: { honeyKg: number; waxKg: number; totalRevenue: number };
      treatments: { total: number; activeWithholdings: number };
    }>('/stats/overview', params as Record<string, string>),

  hive: (id: string, params?: { year?: string }) =>
    api.get(`/stats/hive/${id}`, params as Record<string, string>),

  charts: (params?: { year?: string }) =>
    api.get<{
      year: number;
      monthlyProduction: Array<{ month: string; honeyKg: number }>;
      monthlyHealth: Array<{ month: string; healthy: number; warning: number; critical: number }>;
      treatmentTimeline: Array<{ date: string; product: string; target: string }>;
    }>('/stats/charts', params as Record<string, string>),
};

// Treatments API
export const treatmentsApi = {
  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      hive: { id: string; hiveNumber: string; apiaryName: string };
      treatmentDate: string;
      productName: string;
      productType?: string;
      target?: string;
      dosage?: string;
      startDate: string;
      endDate?: string;
      withholdingPeriodDays?: number;
      withholdingEndDate?: string;
      isActive: boolean;
      notes?: string;
      createdAt: string;
    }>>('/treatments', params),

  get: (id: string) =>
    api.get<{
      id: string;
      hive: { id: string; hiveNumber: string; apiaryName: string };
      treatmentDate: string;
      productName: string;
      productType?: string;
      target?: string;
      dosage?: string;
      startDate: string;
      endDate?: string;
      withholdingPeriodDays?: number;
      withholdingEndDate?: string;
      notes?: string;
      createdAt: string;
    }>(`/treatments/${id}`),

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
  }) => api.post('/treatments', data),

  update: (id: string, data: Partial<{
    productName: string;
    productType: string;
    target: string;
    dosage: string;
    endDate: string;
    notes: string;
  }>) => api.put(`/treatments/${id}`, data),

  delete: (id: string) => api.delete(`/treatments/${id}`),
};

// Feedings API
export const feedingsApi = {
  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      hive: { id: string; hiveNumber: string; apiaryName: string };
      feedingDate: string;
      feedType: string;
      amountKg: number;
      sugarConcentration?: number;
      reason?: string;
      notes?: string;
      createdAt: string;
    }>>('/feedings', params),

  get: (id: string) =>
    api.get<{
      id: string;
      hive: { id: string; hiveNumber: string; apiaryName: string };
      feedingDate: string;
      feedType: string;
      amountKg: number;
      sugarConcentration?: number;
      reason?: string;
      notes?: string;
      createdAt: string;
    }>(`/feedings/${id}`),

  create: (data: {
    hiveId: string;
    feedingDate: string;
    feedType: string;
    amountKg: number;
    sugarConcentration?: number;
    reason?: string;
    notes?: string;
  }) => api.post('/feedings', data),

  update: (id: string, data: Partial<{
    feedType: string;
    amountKg: number;
    sugarConcentration: number;
    reason: string;
    notes: string;
  }>) => api.put(`/feedings/${id}`, data),

  delete: (id: string) => api.delete(`/feedings/${id}`),
};

// Production API
export const productionApi = {
  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      hive?: { id: string; hiveNumber: string };
      apiary?: { id: string; name: string };
      harvestDate: string;
      productType: string;
      honeyType?: string;
      amountKg: number;
      qualityGrade?: string;
      moistureContent?: number;
      pricePerKg?: number;
      totalRevenue?: number;
      soldTo?: string;
      saleDate?: string;
      notes?: string;
      createdAt: string;
    }>>('/production', params),

  get: (id: string) =>
    api.get<{
      id: string;
      hive?: { id: string; hiveNumber: string; apiaryName: string };
      apiary?: { id: string; name: string };
      harvestDate: string;
      productType: string;
      honeyType?: string;
      amountKg: number;
      qualityGrade?: string;
      moistureContent?: number;
      pricePerKg?: number;
      totalRevenue?: number;
      soldTo?: string;
      saleDate?: string;
      notes?: string;
      createdAt: string;
    }>(`/production/${id}`),

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
    soldTo?: string;
    saleDate?: string;
    notes?: string;
  }) => api.post('/production', data),

  update: (id: string, data: Partial<{
    productType: string;
    honeyType: string;
    amountKg: number;
    qualityGrade: string;
    moistureContent: number;
    pricePerKg: number;
    soldTo: string;
    saleDate: string;
    notes: string;
  }>) => api.put(`/production/${id}`, data),

  delete: (id: string) => api.delete(`/production/${id}`),
};

// Reports/Export API
export const reportsApi = {
  downloadCsv: (type: 'inspections' | 'treatments' | 'feedings' | 'production', year?: number) => {
    const params = new URLSearchParams({ type });
    if (year) params.set('year', String(year));
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return fetch(`${API_URL}/stats/export/csv?${params}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
  },

  downloadPdf: (type: 'season' | 'hive' | 'apiary', year?: number, id?: string) => {
    const params = new URLSearchParams({ type });
    if (year) params.set('year', String(year));
    if (id) params.set('id', id);
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return fetch(`${API_URL}/stats/report/pdf?${params}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
  },
};

// Queens API
export const queensApi = {
  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      queenCode: string;
      year: number;
      race?: string;
      color?: string;
      marked: boolean;
      clipped: boolean;
      origin: string;
      status: string;
      statusDate: string;
      rating?: number;
      temperament?: string;
      productivity?: string;
      swarmTendency?: string;
      mother?: { id: string; queenCode: string } | null;
      currentHive?: { id: string; hiveNumber: string; apiaryName: string } | null;
      daughterCount: number;
      notes?: string;
      createdAt: string;
    }>>('/queens', params),

  get: (id: string) =>
    api.get<{
      id: string;
      queenCode: string;
      year: number;
      race?: string;
      color?: string;
      marked: boolean;
      clipped: boolean;
      origin: string;
      status: string;
      statusDate: string;
      motherId?: string;
      matingDate?: string;
      matingStation?: string;
      currentHiveId?: string;
      introducedDate?: string;
      rating?: number;
      temperament?: string;
      productivity?: string;
      swarmTendency?: string;
      notes?: string;
      createdAt: string;
      updatedAt: string;
      mother?: { id: string; queenCode: string; year: number; race?: string; status: string } | null;
      daughters: Array<{ id: string; queenCode: string; year: number; race?: string; status: string }>;
      currentHive?: { id: string; hiveNumber: string; apiaryId: string; apiaryName: string } | null;
      hiveHistory: Array<{
        id: string;
        hive: { id: string; hiveNumber: string; apiaryName: string };
        action: string;
        date: string;
        reason?: string;
        notes?: string;
        createdAt: string;
      }>;
    }>(`/queens/${id}`),

  create: (data: {
    queenCode: string;
    year: number;
    race?: string;
    color?: string;
    marked?: boolean;
    clipped?: boolean;
    origin?: string;
    status?: string;
    motherId?: string;
    matingDate?: string;
    matingStation?: string;
    currentHiveId?: string;
    introducedDate?: string;
    rating?: number;
    temperament?: string;
    productivity?: string;
    swarmTendency?: string;
    notes?: string;
  }) => api.post('/queens', data),

  update: (id: string, data: Partial<{
    queenCode: string;
    year: number;
    race: string | null;
    color: string | null;
    marked: boolean;
    clipped: boolean;
    origin: string;
    status: string;
    motherId: string | null;
    matingDate: string | null;
    matingStation: string | null;
    currentHiveId: string | null;
    introducedDate: string | null;
    rating: number | null;
    temperament: string | null;
    productivity: string | null;
    swarmTendency: string | null;
    notes: string | null;
  }>) => api.put(`/queens/${id}`, data),

  delete: (id: string) => api.delete(`/queens/${id}`),

  move: (id: string, data: { hiveId: string; date: string; reason?: string; notes?: string }) =>
    api.post(`/queens/${id}/move`, data),
};

// Search API
export interface SearchResults {
  query: string;
  results: {
    hives: Array<{ id: string; hiveNumber: string; status: string; apiaryName: string; apiaryId: string; notes?: string }>;
    inspections: Array<{ id: string; inspectionDate: Date; notes?: string; hiveId: string; hiveNumber: string; apiaryName: string }>;
    treatments: Array<{ id: string; productName: string; treatmentDate: Date; notes?: string; hiveId: string; hiveNumber: string; apiaryName: string }>;
    queens: Array<{ id: string; queenCode: string; year: number; race?: string; status: string; notes?: string; hiveId?: string; hiveNumber?: string; apiaryName?: string }>;
  };
}

export const searchApi = {
  search: (q: string, limit?: number) =>
    api.get<SearchResults>('/search', {
      q,
      ...(limit !== undefined && { limit: String(limit) }),
    }),
};

// Photos API
export const photosApi = {
  upload: (formData: FormData) =>
    api.uploadFiles<Array<{
      id: string;
      url: string;
      thumbnailUrl: string;
      filename: string;
    }>>('/photos/upload', formData),

  list: (params?: Record<string, string>) =>
    api.get<Array<{
      id: string;
      url: string;
      thumbnailUrl: string;
      filename: string;
      createdAt: string;
    }>>('/photos', params),

  delete: (id: string) => api.delete(`/photos/${id}`),
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
    api.get<CalendarEvent & { updatedAt: string }>(`/calendar/${id}`),

  create: (data: {
    title: string;
    description?: string;
    eventDate: string;
    endDate?: string;
    eventType: string;
    allDay?: boolean;
    color?: string;
    apiaryId?: string;
    hiveId?: string;
    notes?: string;
  }) => api.post('/calendar', data),

  update: (id: string, data: Partial<{
    title: string;
    description: string | null;
    eventDate: string;
    endDate: string | null;
    eventType: string;
    allDay: boolean;
    color: string | null;
    apiaryId: string | null;
    hiveId: string | null;
    notes: string | null;
    completed: boolean;
  }>) => api.put(`/calendar/${id}`, data),

  delete: (id: string) => api.delete(`/calendar/${id}`),

  sync: () => api.post<{ message: string; created: number; updated: number; deleted: number }>('/calendar/sync'),

  syncStatus: () => api.get<{ enabled: boolean }>('/calendar/sync/status'),

  toggleComplete: async (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const response = await fetch(`${API_URL}/calendar/${id}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    return response.json();
  },
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
