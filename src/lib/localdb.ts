import Dexie, { type Table } from 'dexie';
import type { ActionDoc, AuditDoc, AuditDraft } from '@/types';

export interface AuditSubmission {
  audit: AuditDoc;
  actions: ActionDoc[];
}

export interface ActionResponseSubmission {
  actionId: string;
  comment: string;
  photos: string[];
  byName: string;
}

/** A queued upload: photos first, then Firestore documents in one batch. */
export type OutboxItem = {
  id: string;
  uid: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  /** Short label for the status list, e.g. "Kiln 1 audit". */
  label: string;
} & ({ kind: 'audit'; payload: AuditSubmission } | { kind: 'action-response'; payload: ActionResponseSubmission });

/** Draft records wrap the draft so the uid and sub-area can be indexed. */
export interface DraftRecord {
  id: string;
  uid: string;
  subAreaId: string;
  updatedAt: number;
  payload: AuditDraft;
}

/** Photo blobs kept on the device until uploaded, keyed by their final Storage path. */
export interface PhotoBlob {
  path: string;
  draftId: string | null;
  outboxId: string | null;
  full: Blob;
  thumb: Blob;
  createdAt: number;
  uploaded?: boolean;
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

/** Ask the browser not to clear this data under storage pressure. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported: data is still kept in normal conditions */
  }
}
