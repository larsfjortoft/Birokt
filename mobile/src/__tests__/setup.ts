// Mock expo-secure-store
const secureStoreData: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(secureStoreData[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    secureStoreData[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete secureStoreData[key];
    return Promise.resolve();
  }),
}));

// Export for tests to use
(global as unknown as { __secureStoreClear: () => void }).__secureStoreClear = () => {
  Object.keys(secureStoreData).forEach((k) => delete secureStoreData[k]);
};

// Mock expo-sqlite
const mockDbInstance = {
  execAsync: jest.fn(() => Promise.resolve()),
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 0 })),
  getAllAsync: jest.fn(() => Promise.resolve([])),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  closeAsync: jest.fn(() => Promise.resolve()),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve(mockDbInstance)),
}));

(global as unknown as { __mockDb: typeof mockDbInstance }).__mockDb = mockDbInstance;

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true })
  ),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock expo-file-system
jest.mock('expo-file-system/next', () => ({
  File: jest.fn().mockImplementation(() => ({
    exists: true,
    size: 1024,
  })),
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn((uri: string) =>
    Promise.resolve({ uri: `compressed_${uri}`, width: 800, height: 600 })
  ),
  SaveFormat: { JPEG: 'jpeg' },
}));

// Mock @sentry/react-native
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn((cb: (scope: { setExtras: jest.Mock }) => void) =>
    cb({ setExtras: jest.fn() })
  ),
}));

// Mock global fetch
global.fetch = jest.fn();
