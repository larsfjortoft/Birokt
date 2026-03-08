import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
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
}

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
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }
    await api.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }

      const response = await authApi.me();
      if (response.data) {
        set({
          user: response.data,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false, isAuthenticated: false, user: null });
      }
    } catch {
      await api.clearTokens();
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },
}));
