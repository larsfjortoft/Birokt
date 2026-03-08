import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../stores/auth';

const mockFetch = global.fetch as jest.Mock;
const clearSecureStore = (global as unknown as { __secureStoreClear: () => void }).__secureStoreClear;

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
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
});

describe('Auth Store', () => {
  describe('initial state', () => {
    it('should start with not authenticated', () => {
      const state = useAuthStore.getState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
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

    it('should throw and keep state unchanged on failure', async () => {
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
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear user and tokens', async () => {
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
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('checkAuth', () => {
    it('should restore session with valid token', async () => {
      const mockUser = { id: '1', email: 'test@test.no', name: 'Test' };

      // Set a token in secure store
      await SecureStore.setItemAsync('accessToken', 'validtoken');

      // Mock the /auth/me call
      mockFetch.mockResolvedValueOnce(createSuccessResponse(mockUser));

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
    });

    it('should set not authenticated when no token exists', async () => {
      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should clear tokens and set not authenticated when /me fails', async () => {
      await SecureStore.setItemAsync('accessToken', 'invalidtoken');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
    });
  });
});
