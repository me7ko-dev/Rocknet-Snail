// Runs before every test file: use the in-memory AsyncStorage that the library ships for tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
