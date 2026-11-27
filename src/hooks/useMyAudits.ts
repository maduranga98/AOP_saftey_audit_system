import { useEffect, useState } from 'react';
import { collection, getDocs, getDocsFromCache, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AuditDoc } from '@/types';

/**
 * The signed-in auditor's audits for one month. One read per audit, once per visit;
 * offline it falls back to the device cache.
 */
export function useMyAudits(uid: string | null, month: string) {
  const [audits, setAudits] = useState<AuditDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const q = query(collection(db, 'audits'), where('auditorUid', '==', uid), where('month', '==', month));
    const load = navigator.onLine ? getDocs(q) : getDocsFromCache(q);
    load
      .then((snap) => {
        if (!alive) return;
        const list = snap.docs.map((d) => d.data() as AuditDoc).sort((a, b) => b.clientSubmittedAt - a.clientSubmittedAt);
        setAudits(list);
      })
      .catch((e) => alive && (setError((e as Error).message), setAudits([])));
    return () => {
      alive = false;
    };
  }, [uid, month]);

  return { audits, error };
}
