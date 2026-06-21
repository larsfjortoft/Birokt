import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../stores/auth';

const mockFetch = global.fetch as jest.Mock;
const clearSecureStore = (global as unknown as { __secureStoreClear: () => void }).__secureStoreClear;
const localUser = { id: 'local', email: 'local@birokt.app', name: 'Birøkt' };

function createSuccessResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data, meta: { timestamp: new Date().toISOString(), requestId: '123' } }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearSecureStore();
  // Reset zustand store state
  useAuthStore.setState({ user: localUser, isAuthenticated: true, isLoading: false });
});

describe('Auth Store', () => {
  describe('initial state', () => {
    it('should start in local authenticated mode', () => {
      const state = useAuthStore.getState();

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(localUser);
    });
  });

  describe('login', () => {
    it('should set user and isAuthenticated on success', async () => {
      const mockUser = { id: '1', email: 'test@test.no', name: 'Test' };

      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          user: mockUser,
          accessToken: 'token123',
          refreshToken: 'refresh456',
        })
      );

      await useAuthStore.getState().login('test@test.no', 'password');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
    });

    it('should throw and keep local user on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Feil e-post eller passord' },
          meta: { timestamp: new Date().toISOString(), requestId: '123' },
        }),
      });

      await expect(useAuthStore.getState().login('bad@test.no', 'wrong')).rejects.toBeDefined();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(localUser);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear tokens and keep local authenticated mode', async () => {
      const mockUser = { id: '1', email: 'test@test.no', name: 'Test' };

      // First login
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          user: mockUser,
          accessToken: 'token123',
          refreshToken: 'refresh456',
        })
      );
      await useAuthStore.getState().login('test@test.no', 'password');

      // Then logout
      mockFetch.mockResolvedValueOnce(createSuccessResponse(null));
      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(localUser);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('checkAuth', () => {
    it('should ignore existing tokens and use local user', async () => {
      await SecureStore.setItemAsync('accessToken', 'validtoken');

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(localUser);
      expect(state.isLoading).toBe(false);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    });

    it('should use local user when no token exists', async () => {
      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(localUser);
      expect(state.isLoading).toBe(false);
    });

    it('should not call /me when checking local auth', async () => {
      await SecureStore.setItemAsync('accessToken', 'invalidtoken');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(localUser);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
