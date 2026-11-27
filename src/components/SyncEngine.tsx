import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { requestPersistentStorage } from '@/lib/localdb';
import { onSyncRequest, syncOutbox } from '@/lib/sync';

const RETRY_MS = 60_000;

/** Background uploader: runs on open, when signal returns, on request, and every minute. */
export function SyncEngine() {
  const { uid } = useAuth();

  useEffect(() => {
    if (!uid) return;
    void requestPersistentStorage();
    const run = () => void syncOutbox(uid);
    run();
    window.addEventListener('online', run);
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    const off = onSyncRequest(run);
    const timer = window.setInterval(run, RETRY_MS);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
      off();
      window.clearInterval(timer);
    };
  }, [uid]);

  return null;
}
