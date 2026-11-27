import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Whether the first safety officer exists. Readable before sign-in (public/status). */
export function useSetupStatus(): { adminReady: boolean | null } {
  const [adminReady, setAdminReady] = useState<boolean | null>(null);
  useEffect(() => {
    getDoc(doc(db, 'public', 'status'))
      .then((s) => setAdminReady(Boolean(s.get('adminReady'))))
      .catch(() => setAdminReady(true)); // offline or unknown: don't offer setup
  }, []);
  return { adminReady };
}
