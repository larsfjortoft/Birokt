module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./src/__tests__/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'setup\\.ts$'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|zustand)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/__tests__/**',
    '!src/app/**',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
