import { doc, getDocFromServer, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { getMetadata, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import { localDb, type OutboxItem } from './localdb';
import { forgetPhotoUrl, thumbPath } from './photos';

let running = false;
const listeners = new Set<() => void>();

/** Lets screens ask for an immediate upload, e.g. right after Submit. */
export function requestSync(): void {
  listeners.forEach((fn) => fn());
}
export function onSyncRequest(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const errCode = (e: unknown) => (e as { code?: string })?.code ?? '';

async function uploadOne(path: string, blob: Blob): Promise<void> {
  try {
    await uploadBytes(ref(storage, path), blob, {
      contentType: blob.type || 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });
  } catch (e) {
    // Rules allow create only. On a retry the file may already be there: that counts as done.
    if (errCode(e) === 'storage/unauthorized') {
      try {
        await getMetadata(ref(storage, path));
        return;
      } catch {
        /* not there: report the original error */
      }
    }
    throw e;
  }
}

async function uploadPhotos(outboxId: string): Promise<void> {
  const photos = await localDb.photos.where('outboxId').equals(outboxId).toArray();
  for (const p of photos) {
    if (p.uploaded) continue;
    await uploadOne(p.path, p.full);
    await uploadOne(thumbPath(p.path), p.thumb);
    await localDb.photos.update(p.path, { uploaded: true });
  }
}

/** Reads a document from the server; a missing doc the user can't see yet reads as "absent". */
async function serverDoc(path: string) {
  try {
    const snap = await getDocFromServer(doc(db, path));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    if (errCode(e) === 'permission-denied') return null;
    throw e;
  }
}

async function processItem(item: OutboxItem): Promise<void> {
  await uploadPhotos(item.id);

  if (item.kind === 'audit') {
    const { audit, actions } = item.payload;
    // A retry after a commit that reached the server but not the device: already done.
    if (await serverDoc(`audits/${audit.id}`)) return;
    const batch = writeBatch(db);
    batch.set(doc(db, 'audits', audit.id), { ...audit, submittedAt: serverTimestamp() });
    for (const a of actions) batch.set(doc(db, 'actions', a.id), { ...a, raisedAt: serverTimestamp() });
    await batch.commit();
    return;
  }

  const { actionId, comment, photos, byName } = item.payload;
  const current = await serverDoc(`actions/${actionId}`);
  if (current?.status === 'closed') return;
  await updateDoc(doc(db, 'actions', actionId), {
    status: 'closed',
    response: { comment, photos, byUid: item.uid, byName, at: serverTimestamp() },
    closedAt: serverTimestamp(),
  });
}

async function cleanup(item: OutboxItem): Promise<void> {
  await localDb.transaction('rw', localDb.outbox, localDb.photos, async () => {
    const photos = await localDb.photos.where('outboxId').equals(item.id).toArray();
    photos.forEach((p) => forgetPhotoUrl(p.path));
    await localDb.photos.bulkDelete(photos.map((p) => p.path));
    await localDb.outbox.delete(item.id);
  });
}

function friendlyError(e: unknown): string {
  const code = errCode(e);
  if (code === 'permission-denied' || code === 'storage/unauthorized') return 'Upload refused. Your access may have changed; ask the safety officer.';
  if (code === 'storage/quota-exceeded') return 'Photo storage is full. Tell the safety officer.';
  return (e as Error)?.message || 'Upload failed. It will retry.';
}

/** Uploads everything this user has waiting, oldest first. Safe to call often. */
export async function syncOutbox(uid: string): Promise<void> {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    const items = await localDb.outbox.where('uid').equals(uid).sortBy('createdAt');
    for (const item of items) {
      if (!navigator.onLine) break;
      try {
        await processItem(item);
        await cleanup(item);
      } catch (e) {
        await localDb.outbox.update(item.id, { attempts: item.attempts + 1, lastError: friendlyError(e) });
      }
    }
  } finally {
    running = false;
  }
}
