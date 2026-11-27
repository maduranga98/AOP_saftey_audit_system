import { useLiveQuery } from 'dexie-react-hooks';
import { localDb } from '@/lib/localdb';
import { requestSync } from '@/lib/sync';
import { useOnline } from '@/hooks/useOnline';
import { useAuth } from '@/contexts/AuthContext';
import { CloudOffIcon } from './icons';

/** Slim status strip: hidden when online with nothing waiting. */
export function SyncBar() {
  const online = useOnline();
  const { uid } = useAuth();
  const items = useLiveQuery(() => (uid ? localDb.outbox.where('uid').equals(uid).toArray() : []), [uid], []);
  const pending = items.length;
  const failing = items.find((i) => i.attempts >= 2 && i.lastError);

  if (online && pending === 0) return null;

  const waiting = pending === 1 ? '1 item waiting to upload' : `${pending} items waiting to upload`;

  if (online && failing) {
    return (
      <button onClick={requestSync} className="block w-full bg-red-50 px-4 py-1.5 text-center text-xs font-medium text-red-700" role="status">
        {failing.label}: {failing.lastError} · Tap to retry
      </button>
    );
  }

  return (
    <div
      className={
        online
          ? 'bg-sky-50 px-4 py-1.5 text-center text-xs font-medium text-sky-800'
          : 'flex items-center justify-center gap-1.5 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-800'
      }
      role="status"
    >
      {!online && <CloudOffIcon width={14} height={14} />}
      {online ? `Uploading · ${waiting}` : pending > 0 ? `Offline · ${waiting}` : 'Offline · your work is saved on this device'}
    </div>
  );
}
