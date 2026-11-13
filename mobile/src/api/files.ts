import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { API_BASE, freshAccessToken, http } from './client';
import { ApiError, UNREACHABLE } from './errors';
import type { LocalFile } from '@/contract/mobile';

const MAX_EDGE = 1600; // photos are shrunk before upload: mobile data is the common case

/** Lets the user take a photo or pick from the gallery. Returns null when cancelled. */
export async function pickImage(source: 'camera' | 'library'): Promise<LocalFile | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new ApiError('FORBIDDEN', 'Allow camera access in Settings to take a photo.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled || !result.assets?.length) return null;
  return shrink(result.assets[0]);
}

/**
 * Always re-encodes as JPEG: iOS can hand back HEIC, which the API refuses, and
 * the declared size must match the bytes uploaded exactly.
 */
async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<LocalFile> {
  let ctx = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    ctx = ctx.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const ref = await ctx.renderAsync();
  const { uri } = await ref.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 });
  const file = new File(uri);
  const base = (asset.fileName ?? `photo-${Date.now()}`).replace(/\.[^.]+$/, '');
  return { uri, name: `${base}.jpg`, mimeType: 'image/jpeg', size: file.size ?? asset.fileSize ?? 0 };
}

/**
 * Upload the way the API expects (BACKEND_HANDOFF.md, Uploads): ask for a
 * short-lived link, PUT the bytes straight to storage, return the upload id
 * for the complaint / document to claim.
 */
export async function uploadFile(purpose: 'document' | 'complaint', file: LocalFile): Promise<string> {
  const target = await http.post<{ uploadId: string; url: string; method: string; headers: Record<string, string> }>(
    '/uploads', { purpose, fileName: file.name, contentType: file.mimeType, sizeBytes: file.size });
  let status: number;
  try {
    const res = await new File(file.uri).upload(target.url, {
      httpMethod: (target.method?.toUpperCase() ?? 'PUT') as 'PUT' | 'POST' | 'PATCH',
      headers: target.headers,
    });
    status = res.status;
  } catch {
    throw new ApiError('UNAVAILABLE', "Couldn't upload the file. Check your connection and try again.");
  }
  if (status < 200 || status >= 300) {
    throw new ApiError('VALIDATION', 'The file upload was refused. Try again.', { file: 'The file upload was refused. Try again.' });
  }
  return target.uploadId;
}

/** Downloads an authenticated PDF (e.g. a receipt) and opens the share sheet. */
export async function downloadAndShare(path: string, fileName: string): Promise<void> {
  const token = await freshAccessToken();
  if (!token) throw new ApiError('UNAUTHENTICATED', 'Your session has ended. Sign in again.');
  const dest = new File(Paths.cache, fileName);
  if (dest.exists) dest.delete();
  let saved: File | null;
  try {
    saved = await File.createDownloadTask(`${API_BASE}${path}`, dest, { headers: { Authorization: `Bearer ${token}` } }).downloadAsync();
  } catch {
    throw new ApiError('UNAVAILABLE', UNREACHABLE);
  }
  if (!saved || !saved.exists || (saved.size ?? 0) === 0) throw new ApiError('UNAVAILABLE', "Couldn't download the file. Try again.");
  // An error reply is JSON, not a PDF: surface it instead of sharing it.
  if (saved.type?.includes('json') || (await saved.bytes()).slice(0, 4).toString() !== [0x25, 0x50, 0x44, 0x46].toString()) {
    saved.delete();
    throw new ApiError('UNAVAILABLE', "Couldn't download the file. Try again.");
  }
  if (!(await Sharing.isAvailableAsync())) throw new ApiError('NOT_CONFIGURED', 'Sharing is not available on this device.');
  await Sharing.shareAsync(saved.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
}
