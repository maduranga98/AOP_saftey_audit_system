import Dexie, { type Table } from 'dexie';

/** A queued upload: photos first, then Firestore documents. Filled by the audit and action flows. */
export interface OutboxItem {
  id: string;
  kind: 'audit' | 'action-response';
  uid: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  payload: unknown;
}

/** An audit in progress. Saved on every tap so nothing is lost. */
export interface DraftRecord {
  id: string;
  uid: string;
  subAreaId: string;
  updatedAt: number;
  payload: unknown;
}

/** Photo blobs waiting for upload, keyed by their final Storage path. */
export interface PhotoBlob {
  path: string;
  outboxId: string | null;
  draftId: string | null;
  full: Blob;
  thumb: Blob;
  createdAt: number;
}

class LocalDB extends Dexie {
  outbox!: Table<OutboxItem, string>;
  drafts!: Table<DraftRecord, string>;
  photos!: Table<PhotoBlob, string>;

  constructor() {
    super('aop-local');
    this.version(1).stores({
      outbox: 'id, uid, createdAt',
      drafts: 'id, uid, subAreaId, updatedAt',
      photos: 'path, outboxId, draftId',
    });
  }
}

export const localDb = new LocalDB();
