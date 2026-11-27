import { useEffect, useRef, useState } from 'react';
import { photoUrl } from '@/lib/photos';
import { CameraIcon, XIcon } from './icons';
import { Spinner, cx } from './ui';

export function PhotoThumb({ path, onOpen, onRemove }: { path: string; onOpen?: () => void; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    photoUrl(path, 'thumb')
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <div className="relative h-16 w-16 shrink-0">
      <button
        type="button"
        onClick={onOpen}
        className="h-16 w-16 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"
        aria-label="Open photo"
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] text-slate-400">{failed ? 'Offline' : '…'}</span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow"
          aria-label="Remove photo"
        >
          <XIcon width={14} height={14} />
        </button>
      )}
    </div>
  );
}

/** Full-screen photo viewer. */
export function PhotoViewer({ path, onClose }: { path: string | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!path) return;
    let alive = true;
    photoUrl(path, 'full')
      .then((u) => alive && setUrl(u))
      .catch(() => photoUrl(path, 'thumb').then((u) => alive && setUrl(u)).catch(() => undefined));
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={onClose} role="dialog" aria-label="Photo">
      {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <Spinner className="h-6 w-6 text-white" />}
      <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close">
        <XIcon />
      </button>
    </div>
  );
}

/** Photo row for one observation. With `onAdd` it shows a camera button; with `onRemove` each photo can be removed. */
export function PhotoStrip({
  paths,
  max,
  onAdd,
  onRemove,
  busy,
}: {
  paths: string[];
  max?: number;
  onAdd?: (files: File[]) => void;
  onRemove?: (path: string) => void;
  busy?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const canAdd = onAdd && (max === undefined || paths.length < max);

  if (!onAdd && paths.length === 0) return null;
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 pt-1.5">
        {paths.map((p) => (
          <PhotoThumb key={p} path={p} onOpen={() => setOpen(p)} onRemove={onRemove ? () => onRemove(p) : undefined} />
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className={cx(
              'flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-300 text-slate-500',
              'active:bg-slate-50 disabled:opacity-60',
            )}
          >
            {busy ? <Spinner className="h-5 w-5" /> : <CameraIcon />}
            <span className="text-[10px]">{busy ? 'Saving' : 'Photo'}</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) onAdd?.(files);
          }}
        />
      </div>
      <PhotoViewer path={open} onClose={() => setOpen(null)} />
    </>
  );
}
