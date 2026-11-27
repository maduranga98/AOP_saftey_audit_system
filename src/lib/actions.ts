import { localDb } from './localdb';
import { compressPhoto, forgetPhotoUrl, photoExt } from './photos';
import { newId } from './drafts';
import { MAX_PHOTOS_PER_ITEM, type ActionDoc } from '@/types';

/** Local key for photos taken for a response that is not submitted yet. */
export const responseDraftId = (actionId: string) => `resp_${actionId}`;

export async function addResponsePhotos(actionId: string, files: File[], already: number): Promise<string[]> {
  const room = Math.max(0, MAX_PHOTOS_PER_ITEM - already);
  const paths: string[] = [];
  for (const file of files.slice(0, room)) {
    if (!file.type.startsWith('image/')) continue;
    const { full, thumb } = await compressPhoto(file);
    const path = `actions/${actionId}/${newId()}.${photoExt()}`;
    await localDb.photos.put({ path, draftId: responseDraftId(actionId), outboxId: null, full, thumb, createdAt: Date.now() });
    paths.push(path);
  }
  return paths;
}

export async function removeResponsePhoto(path: string): Promise<void> {
  forgetPhotoUrl(path);
  await localDb.photos.delete(path);
}

/** Photos already taken for this response (survive leaving the page). */
export async function pendingResponsePhotos(actionId: string): Promise<string[]> {
  const rows = await localDb.photos.where('draftId').equals(responseDraftId(actionId)).sortBy('createdAt');
  return rows.map((r) => r.path);
}

/** Queues the response; it uploads photos, then closes the action, when there is signal. */
export async function enqueueResponse(uid: string, byName: string, action: ActionDoc, comment: string, photos: string[]): Promise<void> {
  const id = responseDraftId(action.id);
  await localDb.transaction('rw', localDb.outbox, localDb.photos, async () => {
    await localDb.outbox.put({
      id,
      uid,
      createdAt: Date.now(),
      attempts: 0,
      kind: 'action-response',
      label: `${action.subAreaName} · item ${action.obsNo}`,
      payload: { actionId: action.id, comment: comment.trim(), photos, byName },
    });
    await localDb.photos.where('draftId').equals(id).modify({ draftId: null, outboxId: id });
  });
}
