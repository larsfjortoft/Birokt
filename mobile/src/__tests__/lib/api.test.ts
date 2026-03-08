import * as SecureStore from 'expo-secure-store';
import { api } from '../../lib/api';

const mockFetch = global.fetch as jest.Mock;
const clearSecureStore = (global as unknown as { __secureStoreClear: () => void }).__secureStoreClear;

beforeEach(() => {
  jest.clearAllMocks();
  clearSecureStore();
});

function createSuccessResponse(data: unknown, status = 200) {
  return {
    ok: true,
    status,
    json: () => Promise.resolve({ success: true, data, meta: { timestamp: new Date().toISOString(), requestId: '123' } }),
  };
}

function createErrorResponse(code: string, message: string, status = 400) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ success: false, error: { code, message }, meta: { timestamp: new Date().toISOString(), requestId: '123' } }),
  };
}

describe('ApiClient', () => {
  describe('token storage', () => {
    it('should save auth tokens', async () => {
      await api.saveAuthTokens('access123', 'refresh456');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', 'access123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'refresh456');
    });

    it('should clear tokens', async () => {
      await api.clearTokens();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('authenticated requests', () => {
    it('should include Bearer token in Authorization header', async () => {
      await api.saveAuthTokens('mytoken', 'refresh');
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: '1' }));

      await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mytoken',
          }),
        })
      );
    });

    it('should not include Authorization header when no token', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: '1' }));

      await api.get('/test');

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.Authorization).toBeUndefined();
    });
  });

  describe('token refresh on 401', () => {
    it('should attempt token refresh on 401 and retry', async () => {
      await api.saveAuthTokens('expired', 'validrefresh');

      // First call returns 401
      mockFetch.mockResolvedValueOnce(createErrorResponse('UNAUTHORIZED', 'Token expired', 401));
      // Refresh call succeeds
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ accessToken: 'newtoken' }));
      // Retry succeeds
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: '1' }));

      const result = await api.get('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.data).toEqual({ id: '1' });
    });

    it('should clear tokens when refresh fails', async () => {
      await api.saveAuthTokens('expired', 'badrefresh');

      // First call returns 401
      mockFetch.mockResolvedValueOnce(createErrorResponse('UNAUTHORIZED', 'Token expired', 401));
      // Refresh call fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) });

      try {
        await api.get('/test');
      } catch {
        // Expected to throw
      }

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('response parsing', () => {
    it('should parse successful JSON response', async () => {
      const responseData = { name: 'Test Apiary', id: '123' };
      mockFetch.mockResolvedValueOnce(createSuccessResponse(responseData));

      const result = await api.get('/apiaries');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(responseData);
    });

    it('should handle 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      const result = await api.delete('/test/1');

      expect(result).toBeUndefined();
    });

    it('should throw on error responses', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse('VALIDATION_ERROR', 'Invalid input'));

      await expect(api.get('/test')).rejects.toEqual(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        })
      );
    });
  });

  describe('HTTP methods', () => {
    it('should send POST with JSON body', async () => {
      const body = { name: 'New Apiary' };
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: '1' }));

      await api.post('/apiaries', body);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/apiaries'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    });

    it('should send PUT with JSON body', async () => {
      const body = { name: 'Updated' };
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: '1' }));

      await api.put('/apiaries/1', body);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/apiaries/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body),
        })
      );
    });
  });
});
