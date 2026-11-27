import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { addResponsePhotos, enqueueResponse, pendingResponsePhotos, removeResponsePhoto } from '@/lib/actions';
import { requestSync } from '@/lib/sync';
import { formatDateTime } from '@/lib/dates';
import { SCALE } from '@/lib/score';
import { usePendingResponses } from '@/hooks/useAreaData';
import { MAX_PHOTOS_PER_ITEM, type ActionDoc } from '@/types';
import { PhotoStrip } from '@/components/Photos';
import { ageDays, scoreChipClass } from '@/components/ActionRow';
import { Alert, Badge, Button, Card, EmptyState, FullScreenSpinner, cx } from '@/components/ui';
import { ArrowLeftIcon } from '@/components/icons';

const MIN_COMMENT = 5;

const toMillis = (ts: unknown) => (ts as { toMillis?: () => number } | null)?.toMillis?.() ?? null;

export default function ActionDetail() {
  const { actionId = '' } = useParams();
  const navigate = useNavigate();
  const { uid, name } = useAuth();
  const pending = usePendingResponses(uid);
  const [action, setAction] = useState<ActionDoc | null | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'actions', actionId),
        (s) => setAction(s.exists() ? (s.data() as ActionDoc) : null),
        () => setAction(null),
      ),
    [actionId],
  );

  useEffect(() => {
    pendingResponsePhotos(actionId).then(setPhotos);
    const saved = sessionStorage.getItem(`aop.resp.${actionId}`);
    if (saved) setComment(saved);
  }, [actionId]);

  useEffect(() => {
    sessionStorage.setItem(`aop.resp.${actionId}`, comment);
  }, [actionId, comment]);

  if (action === undefined) return <FullScreenSpinner />;
  if (action === null) return <EmptyState title="Action not available" body="It may have been removed, or you don't have access." action={<Link to="/area" className="text-sm font-medium underline">Back</Link>} />;

  const isPending = pending.has(action.id);
  const isClosed = action.status === 'closed';
  const canRespond = !isClosed && !isPending && uid !== null && action.assigneeIds.includes(uid);
  const commentOk = comment.trim().length >= MIN_COMMENT;
  const photosOk = photos.length >= 1;
  const age = ageDays(action.raisedAt);
  const label = SCALE.find((s) => s.value === action.score)?.label;

  const onAdd = async (files: File[]) => {
    setPhotoBusy(true);
    setError(null);
    try {
      const added = await addResponsePhotos(action.id, files, photos.length);
      setPhotos((p) => [...p, ...added]);
    } catch {
      setError('Could not save the photo. Try again.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const onRemove = async (path: string) => {
    setPhotos((p) => p.filter((x) => x !== path));
    await removeResponsePhoto(path);
  };

  const submit = async () => {
    setShowErrors(true);
    if (!uid || !commentOk || !photosOk) return;
    setSubmitting(true);
    setError(null);
    try {
      await enqueueResponse(uid, name, action, comment, photos);
      sessionStorage.removeItem(`aop.resp.${action.id}`);
      requestSync();
      navigate('/area', { replace: true });
    } catch (e) {
      setError((e as Error).message || 'Could not submit. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <Link to="/area" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeftIcon width={16} height={16} /> Back
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {action.areaName} · {action.subAreaName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Corrective action</h1>
          {isClosed ? (
            <Badge className="bg-green-50 text-green-700 ring-green-600/20">Closed</Badge>
          ) : isPending ? (
            <Badge className="bg-sky-50 text-sky-700 ring-sky-600/20">Waiting to upload</Badge>
          ) : (
            <Badge className={age !== null && age > 14 ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'}>
              Open{age !== null ? ` · ${age} day${age === 1 ? '' : 's'}` : ''}
            </Badge>
          )}
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{action.obsNo}</span>
          <p className="text-[15px] leading-snug">{action.obsText}</p>
        </div>
        <div className="space-y-1 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={cx('rounded-md px-1.5 py-0.5 font-semibold', scoreChipClass(action.score))}>
              {action.score} · {label}
            </span>
            <span>
              {action.raisedByName}
              {toMillis(action.raisedAt) && ` · ${formatDateTime(toMillis(action.raisedAt)!)}`}
            </span>
          </div>
          <p className="text-sm text-slate-800">{action.remark}</p>
          <PhotoStrip paths={action.photos} />
        </div>
        <Link to={`/area/audit/${action.auditId}`} className="inline-block text-xs font-medium text-slate-600 hover:underline">
          View the full audit
        </Link>
      </Card>

      {isClosed && action.response && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Response</h2>
          <Card className="space-y-2 p-4">
            <p className="text-xs text-slate-500">
              {action.response.byName}
              {toMillis(action.closedAt) && ` · ${formatDateTime(toMillis(action.closedAt)!)}`}
            </p>
            <p className="text-sm">{action.response.comment}</p>
            <PhotoStrip paths={action.response.photos} />
          </Card>
        </section>
      )}

      {isPending && <Alert tone="info">Your response is saved on this device and closes the action as soon as there is signal.</Alert>}

      {canRespond && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Close this action</h2>
          {error && <Alert>{error}</Alert>}
          <Card className="space-y-3 p-4">
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="What was done to fix it?"
                className={cx(
                  'block w-full resize-none rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-slate-900',
                  showErrors && !commentOk ? 'bg-red-50 ring-red-300' : 'bg-slate-50 ring-slate-200',
                )}
              />
              {showErrors && !commentOk && <p className="mt-1 text-xs font-medium text-red-600">Describe what was done.</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Photo proof (at least 1)</p>
              <PhotoStrip paths={photos} max={MAX_PHOTOS_PER_ITEM} busy={photoBusy} onAdd={onAdd} onRemove={onRemove} />
              {showErrors && !photosOk && <p className="mt-1 text-xs font-medium text-red-600">Add at least one photo of the fix.</p>}
            </div>
          </Card>
          <Button size="lg" className="w-full" onClick={submit} loading={submitting}>
            Submit and close action
          </Button>
          <p className="text-center text-xs text-slate-500">The action closes as soon as it uploads. It can't be reopened.</p>
        </section>
      )}
    </div>
  );
}
