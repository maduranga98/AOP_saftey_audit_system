import { localDb } from './localdb';
import { compressPhoto, forgetPhotoUrl, photoExt } from './photos';
import { MAX_PHOTOS_PER_ITEM, type AuditDraft, type AuditItem, type Observation } from '@/types';

export const newId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Opens the user's draft for a sub-area, or starts one with a copy of the current checklist. */
export async function openDraft(uid: string, subAreaId: string, observations: Observation[]): Promise<AuditDraft> {
  const existing = await localDb.drafts.where('subAreaId').equals(subAreaId).filter((d) => d.uid === uid).first();
  if (existing) return existing.payload;

  const now = Date.now();
  const draft: AuditDraft = {
    id: newId(),
    uid,
    subAreaId,
    startedAt: now,
    updatedAt: now,
    items: observations.map<AuditItem>((o, i) => ({
      obsId: o.id,
      no: i + 1,
      text: o.text,
      score: null,
      na: false,
      remark: '',
      photos: [],
    })),
  };
  await saveDraft(draft);
  return draft;
}

export async function getDraft(id: string): Promise<AuditDraft | undefined> {
  return (await localDb.drafts.get(id))?.payload;
}

export async function saveDraft(draft: AuditDraft): Promise<void> {
  const updated = { ...draft, updatedAt: Date.now() };
  await localDb.drafts.put({ id: draft.id, uid: draft.uid, subAreaId: draft.subAreaId, updatedAt: updated.updatedAt, payload: updated });
}

/** Deletes a draft and its photos from the device. */
export async function discardDraft(id: string): Promise<void> {
  await localDb.transaction('rw', localDb.drafts, localDb.photos, async () => {
    const photos = await localDb.photos.where('draftId').equals(id).toArray();
    photos.forEach((p) => forgetPhotoUrl(p.path));
    await localDb.photos.bulkDelete(photos.map((p) => p.path));
    await localDb.drafts.delete(id);
  });
}

/** Compresses and stores photos for one observation. Returns the new Storage paths. */
export async function addPhotos(draftId: string, obsId: string, files: File[], already: number): Promise<string[]> {
  const room = Math.max(0, MAX_PHOTOS_PER_ITEM - already);
  const paths: string[] = [];
  for (const file of files.slice(0, room)) {
    if (!file.type.startsWith('image/')) continue;
    const { full, thumb } = await compressPhoto(file);
    const path = `audits/${draftId}/${obsId}/${newId()}.${photoExt()}`;
    await localDb.photos.put({ path, draftId, outboxId: null, full, thumb, createdAt: Date.now() });
    paths.push(path);
  }
  return paths;
}

export async function removePhoto(path: string): Promise<void> {
  forgetPhotoUrl(path);
  await localDb.photos.delete(path);
}
