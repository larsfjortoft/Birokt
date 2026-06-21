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
}

const localUser: User = {
  id: 'local',
  email: 'local@birokt.app',
  name: 'Birøkt',
};

export const useAuthStore = create<AuthState>((set) => ({
  user: localUser,
  isLoading: false,
  isAuthenticated: true,

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
    set({ user: localUser, isAuthenticated: true, isLoading: false });
  },

  checkAuth: async () => {
    await api.clearTokens();
    set({ isLoading: false, isAuthenticated: true, user: localUser });
  },
}));
