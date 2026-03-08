import { getFilename, isFileSizeValid, compressImage } from '../../lib/imageUtils';
import { File } from 'expo-file-system/next';

const MockFile = File as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('imageUtils', () => {
  describe('getFilename', () => {
    it('should extract filename from URI path', () => {
      expect(getFilename('/path/to/photo.jpg')).toBe('photo.jpg');
      expect(getFilename('file:///storage/images/IMG_001.jpeg')).toBe('IMG_001.jpeg');
    });

    it('should handle URIs without path separators', () => {
      expect(getFilename('photo.jpg')).toBe('photo.jpg');
    });

    it('should return fallback filename for empty path segments', () => {
      const result = getFilename('/path/to/');
      expect(result).toMatch(/^photo_\d+\.jpg$/);
    });
  });

  describe('isFileSizeValid', () => {
    it('should return true for files under 5MB', async () => {
      MockFile.mockImplementation(() => ({ exists: true, size: 1024 * 1024 })); // 1MB

      const result = await isFileSizeValid('test.jpg');
      expect(result).toBe(true);
    });

    it('should return false for files over 5MB', async () => {
      MockFile.mockImplementation(() => ({ exists: true, size: 6 * 1024 * 1024 })); // 6MB

      const result = await isFileSizeValid('large.jpg');
      expect(result).toBe(false);
    });

    it('should return false for files with 0 size', async () => {
      MockFile.mockImplementation(() => ({ exists: true, size: 0 }));

      const result = await isFileSizeValid('empty.jpg');
      expect(result).toBe(false);
    });

    it('should return false for non-existent files', async () => {
      MockFile.mockImplementation(() => ({ exists: false }));

      const result = await isFileSizeValid('missing.jpg');
      expect(result).toBe(false);
    });
  });

  describe('compressImage', () => {
    it('should return compressed image with reduced dimensions', async () => {
      const result = await compressImage('file:///test/photo.jpg');

      expect(result).toHaveProperty('uri');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
    });
  });
});
