import imageCompression from 'browser-image-compression';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from './firebase';
import { localDb } from './localdb';

const FULL_MAX_PX = 1600;
const THUMB_MAX_PX = 320;

let webpSupport: boolean | null = null;
/** Older iPhones cannot encode WebP from a canvas; they get JPEG instead. */
function canEncodeWebp(): boolean {
  if (webpSupport === null) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupport;
}

export function photoExt(): 'webp' | 'jpg' {
  return canEncodeWebp() ? 'webp' : 'jpg';
}

/** Thumbnail path for a full-size photo path: `a/b/c.webp` → `a/b/c_t.webp`. */
export function thumbPath(path: string): string {
  return path.replace(/(\.[a-z]+)$/, '_t$1');
}

/** Compresses a camera photo on the device: about 200 KB full size, about 20 KB thumbnail. */
export async function compressPhoto(file: File): Promise<{ full: Blob; thumb: Blob }> {
  const fileType = canEncodeWebp() ? 'image/webp' : 'image/jpeg';
  const [full, thumb] = await Promise.all([
    imageCompression(file, { maxWidthOrHeight: FULL_MAX_PX, maxSizeMB: 0.35, initialQuality: 0.8, fileType, useWebWorker: true }),
    imageCompression(file, { maxWidthOrHeight: THUMB_MAX_PX, maxSizeMB: 0.04, initialQuality: 0.7, fileType, useWebWorker: true }),
  ]);
  return { full, thumb };
}

const urlCache = new Map<string, string>();

/**
 * URL to show a photo: the local blob while it waits on the device, otherwise the uploaded file.
 * Download URLs are cached for the session so a list does not request them twice.
 */
export async function photoUrl(path: string, size: 'thumb' | 'full' = 'thumb'): Promise<string> {
  const key = `${size}:${path}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const local = await localDb.photos.get(path);
  let url: string;
  if (local) {
    url = URL.createObjectURL(size === 'thumb' ? local.thumb : local.full);
  } else {
    url = await getDownloadURL(ref(storage, size === 'thumb' ? thumbPath(path) : path));
  }
  urlCache.set(key, url);
  return url;
}

export function forgetPhotoUrl(path: string): void {
  for (const size of ['thumb', 'full']) {
    const key = `${size}:${path}`;
    const url = urlCache.get(key);
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}
