import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system/next';

const MAX_WIDTH = 1200;
const COMPRESSION_QUALITY = 0.7;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

export async function compressImage(uri: string): Promise<CompressedImage> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    {
      compress: COMPRESSION_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

export async function getFileSize(uri: string): Promise<number> {
  try {
    const file = new File(uri);
    if (file.exists) {
      return file.size ?? 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function isFileSizeValid(uri: string): Promise<boolean> {
  const size = await getFileSize(uri);
  return size > 0 && size <= MAX_FILE_SIZE_BYTES;
}

export function getFilename(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] || `photo_${Date.now()}.jpg`;
}
