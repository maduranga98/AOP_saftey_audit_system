import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocs, limit, query, startAfter, type Query, type QueryDocumentSnapshot } from 'firebase/firestore';

/**
 * Loads a query 25 documents at a time ("Load more"), so long lists never cost more reads
 * than the rows actually shown. `key` resets the list when filters change.
 */
export function usePagedQuery<T>(base: Query | null, key: string, pageSize = 25) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const gen = useRef(0);

  const load = useCallback(
    async (reset: boolean) => {
      if (!base) return;
      const my = reset ? ++gen.current : gen.current;
      setLoading(true);
      setError(null);
      try {
        const q = reset || !cursor.current ? query(base, limit(pageSize)) : query(base, startAfter(cursor.current), limit(pageSize));
        const snap = await getDocs(q);
        if (my !== gen.current) return;
        cursor.current = snap.docs.at(-1) ?? cursor.current;
        const page = snap.docs.map((d) => d.data() as T);
        setRows((r) => (reset ? page : [...r, ...page]));
        setDone(snap.docs.length < pageSize);
      } catch (e) {
        if (my === gen.current) setError((e as Error).message);
      } finally {
        if (my === gen.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, pageSize],
  );

  useEffect(() => {
    cursor.current = null;
    setRows([]);
    setDone(false);
    void load(true);
  }, [load]);

  return { rows, loading, done, error, loadMore: () => load(false), reload: () => load(true) };
}
