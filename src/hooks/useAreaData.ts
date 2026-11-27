import { useEffect, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/firebase';
import { localDb } from '@/lib/localdb';
import type { ActionDoc, AuditDoc } from '@/types';

/** Open actions for sub-areas where the user is owner or manager. Live: one read per open action, then only changes. */
export function useOpenActions(uid: string | null) {
  const [actions, setActions] = useState<ActionDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'actions'), where('assigneeIds', 'array-contains', uid), where('status', '==', 'open'), orderBy('raisedAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setActions(snap.docs.map((d) => d.data() as ActionDoc)),
      (e) => {
        setError(e.message);
        setActions([]);
      },
    );
  }, [uid]);

  return { actions, error };
}

/** Recently closed actions, loaded once when asked for. */
export function useClosedActions(uid: string | null, max = 30) {
  const [actions, setActions] = useState<ActionDoc[] | null>(null);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'actions'), where('assigneeIds', 'array-contains', uid), where('status', '==', 'closed'), orderBy('raisedAt', 'desc'), limit(max));
    getDocs(q)
      .then((s) => setActions(s.docs.map((d) => d.data() as ActionDoc)))
      .catch(() => setActions([]));
  }, [uid, max]);
  return actions;
}

/** Audits of the user's sub-areas for one month. */
export function useAreaAudits(uid: string | null, month: string) {
  const [audits, setAudits] = useState<AuditDoc[] | null>(null);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'audits'), where('assigneeIds', 'array-contains', uid), where('month', '==', month));
    getDocs(q)
      .then((s) =>
        setAudits(
          s.docs
            .map((d) => d.data() as AuditDoc)
            .filter((a) => !a.voided)
            .sort((a, b) => b.clientSubmittedAt - a.clientSubmittedAt),
        ),
      )
      .catch(() => setAudits([]));
  }, [uid, month]);
  return audits;
}

/** Action ids with a response waiting in this device's outbox. */
export function usePendingResponses(uid: string | null): Set<string> {
  const ids = useLiveQuery(
    async () =>
      uid
        ? (await localDb.outbox.where('uid').equals(uid).toArray())
            .filter((o) => o.kind === 'action-response')
            .map((o) => (o.kind === 'action-response' ? o.payload.actionId : ''))
        : [],
    [uid],
    [] as string[],
  );
  return new Set(ids);
}
