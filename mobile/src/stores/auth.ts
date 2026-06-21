import { create } from 'zustand';
import { api, authApi } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string | null }) => Promise<void>;
}

const localUser: User = {
  id: 'local',
  email: 'local@birokt.app',
  name: 'Birøkt',
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login({ email, password });
      if (response.data) {
        await api.saveAuthTokens(response.data.accessToken, response.data.refreshToken);
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register({ email, password, name });
      if (response.data) {
        await api.saveAuthTokens(response.data.accessToken, response.data.refreshToken);
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await api.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      // The Raspberry Pi installation is intentionally single-user. Requests
      // without a bearer token are attached to its one local Birøkt user.
      const response = await authApi.me();
      if (response.data) {
        set({ user: response.data, isAuthenticated: true, isLoading: false });
        return;
      }
    } catch {
      await api.clearTokens();
    }
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  updateProfile: async (data) => {
    const response = await authApi.updateProfile(data);
    const updatedUser = response.data;
    if (updatedUser) {
      set((state) => ({
        user: state.user ? { ...state.user, ...updatedUser, phone: updatedUser.phone ?? undefined } : state.user,
      }));
    }
  },
}));
