import { useLiveQuery } from 'dexie-react-hooks';
import { localDb } from '@/lib/localdb';
import { useOnline } from '@/hooks/useOnline';
import { useAuth } from '@/contexts/AuthContext';
import { CloudOffIcon } from './icons';

/** Slim status strip: hidden when online with nothing waiting. */
export function SyncBar() {
  const online = useOnline();
  const { uid } = useAuth();
  const pending = useLiveQuery(() => (uid ? localDb.outbox.where('uid').equals(uid).count() : 0), [uid], 0);

  if (online && pending === 0) return null;

  const waiting = pending === 1 ? '1 item waiting to upload' : `${pending} items waiting to upload`;
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
