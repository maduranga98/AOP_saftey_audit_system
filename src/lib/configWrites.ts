import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { ConfigMain, SubArea } from '@/types';

/**
 * Admin edits to config/main run in a transaction so they never overwrite a change made at the
 * same time by a Cloud Function (for example a new user added to the people directory).
 * Transactions need a connection; admin setup is done online.
 */
export async function updateSubArea(subAreaId: string, patch: Partial<Omit<SubArea, 'id'>>): Promise<void> {
  if (!navigator.onLine) throw new Error('You are offline. Setup changes need a connection.');
  const ref = doc(db, 'config', 'main');
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Plant setup has not been imported yet.');
    const data = snap.data() as ConfigMain;
    const idx = data.subAreas.findIndex((s) => s.id === subAreaId);
    if (idx < 0) throw new Error('Sub-area no longer exists.');
    const subAreas = [...data.subAreas];
    subAreas[idx] = { ...subAreas[idx], ...patch };
    tx.update(ref, { subAreas, updatedAt: serverTimestamp() });
  });
}
