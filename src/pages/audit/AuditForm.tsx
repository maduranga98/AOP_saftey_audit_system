import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { addPhotos, discardDraft, getDraft, removePhoto, saveDraft } from '@/lib/drafts';
import { buildSubmission, computeTotals, enqueueAudit, itemProblem, remarkRequired } from '@/lib/audit';
import { requestSync } from '@/lib/sync';
import { BAND_CLASS, bandOf, formatPct } from '@/lib/score';
import { MAX_PHOTOS_PER_ITEM, type AuditDraft, type AuditItem, type ScoreValue } from '@/types';
import { ScoreButtons } from '@/components/ScoreButtons';
import { PhotoStrip } from '@/components/Photos';
import { SubAreaHeader } from '@/components/SubAreaHeader';
import { Alert, Button, EmptyState, FullScreenSpinner, Modal, cx } from '@/components/ui';
import { AlertIcon, ArrowLeftIcon, TrashIcon } from '@/components/icons';

const SAVE_DELAY_MS = 300;

interface CardProps {
  item: AuditItem;
  showErrors: boolean;
  photoBusy: boolean;
  onScore: (obsId: string, score: ScoreValue | null, na: boolean) => void;
  onRemark: (obsId: string, remark: string) => void;
  onAddPhotos: (obsId: string, files: File[]) => void;
  onRemovePhoto: (obsId: string, path: string) => void;
}

const ObservationCard = memo(function ObservationCard({ item, showErrors, photoBusy, onScore, onRemark, onAddPhotos, onRemovePhoto }: CardProps) {
  const problem = itemProblem(item);
  const flagged = showErrors && problem !== null;
  const needsRemark = remarkRequired(item);

  return (
    <section
      id={`obs-${item.obsId}`}
      className={cx('scroll-mt-28 space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1', flagged ? 'ring-2 ring-red-400' : 'ring-slate-200')}
    >
      <div className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{item.no}</span>
        <p className="text-[15px] leading-snug text-slate-900">{item.text}</p>
      </div>

      <ScoreButtons score={item.score} na={item.na} onChange={(s, na) => onScore(item.obsId, s, na)} />

      <div>
        <textarea
          value={item.remark}
          onChange={(e) => onRemark(item.obsId, e.target.value)}
          rows={needsRemark || item.remark ? 2 : 1}
          placeholder={needsRemark ? (item.na ? 'Why is this not applicable? (required)' : 'What did you find? (required)') : 'Remark (optional)'}
          className={cx(
            'block w-full resize-none rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-slate-900',
            flagged && problem === 'remark' ? 'bg-red-50 ring-red-300' : 'bg-slate-50 ring-slate-200',
          )}
        />
        {flagged && (
          <p className="mt-1 text-xs font-medium text-red-600">{problem === 'score' ? 'Pick a score or NA.' : 'Write a remark for this score.'}</p>
        )}
      </div>

      <PhotoStrip
        paths={item.photos}
        max={MAX_PHOTOS_PER_ITEM}
        busy={photoBusy}
        onAdd={(files) => onAddPhotos(item.obsId, files)}
        onRemove={(p) => onRemovePhoto(item.obsId, p)}
      />
    </section>
  );
});

export default function AuditForm() {
  const { draftId = '' } = useParams();
  const navigate = useNavigate();
  const { uid, name, empNo } = useAuth();
  const { config, subAreaById } = useConfig();

  const [draft, setDraft] = useState<AuditDraft | null | undefined>(undefined);
  const [showErrors, setShowErrors] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busyObs, setBusyObs] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number>();
  const latest = useRef<AuditDraft | null>(null);

  useEffect(() => {
    getDraft(draftId).then((d) => {
      latest.current = d ?? null;
      setDraft(d ?? null);
    });
  }, [draftId]);

  // Save on every change (debounced), and immediately when the page is hidden or closed.
  const flush = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    if (latest.current) void saveDraft(latest.current);
  }, []);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  const update = useCallback((obsId: string, patch: (i: AuditItem) => Partial<AuditItem>) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, items: d.items.map((i) => (i.obsId === obsId ? { ...i, ...patch(i) } : i)) };
      latest.current = next;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void saveDraft(next), SAVE_DELAY_MS);
      return next;
    });
  }, []);

  const onScore = useCallback((obsId: string, score: ScoreValue | null, na: boolean) => update(obsId, () => ({ score, na })), [update]);
  const onRemark = useCallback((obsId: string, remark: string) => update(obsId, () => ({ remark })), [update]);
  const onRemovePhoto = useCallback(
    (obsId: string, path: string) => {
      update(obsId, (i) => ({ photos: i.photos.filter((p) => p !== path) }));
      void removePhoto(path);
    },
    [update],
  );
  const onAddPhotos = useCallback(
    async (obsId: string, files: File[]) => {
      const item = latest.current?.items.find((i) => i.obsId === obsId);
      if (!item || !latest.current) return;
      setBusyObs(obsId);
      setError(null);
      try {
        const paths = await addPhotos(latest.current.id, obsId, files, item.photos.length);
        update(obsId, (i) => ({ photos: [...i.photos, ...paths] }));
      } catch {
        setError('Could not save the photo. Try again.');
      } finally {
        setBusyObs(null);
      }
    },
    [update],
  );

  const totals = useMemo(() => (draft ? computeTotals(draft.items) : null), [draft]);
  const problems = useMemo(() => (draft ? draft.items.filter((i) => itemProblem(i) !== null) : []), [draft]);
  const done = draft ? draft.items.length - draft.items.filter((i) => !i.na && i.score === null).length : 0;

  if (draft === undefined) return <FullScreenSpinner label="Opening audit…" />;
  if (draft === null || draft.uid !== uid) {
    return <EmptyState title="Audit not found on this device" body="It may have been submitted or discarded." action={<Link to="/audit" className="text-sm font-medium underline">Back to sub-areas</Link>} />;
  }
  const subArea = subAreaById.get(draft.subAreaId);
  if (!subArea || !config) return <EmptyState title="Sub-area not found" body="It was removed from the plant setup." />;

  const jumpTo = (obsId: string) => {
    setReviewOpen(false);
    setShowErrors(true);
    requestAnimationFrame(() => document.getElementById(`obs-${obsId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const submit = async () => {
    if (!uid || problems.length) return;
    setSubmitting(true);
    setError(null);
    try {
      flush();
      const current = latest.current!;
      const submission = buildSubmission(current, config, { uid, name, empNo });
      await enqueueAudit(current, submission);
      requestSync();
      navigate('/audit', { replace: true, state: { submitted: subArea.name } });
    } catch (e) {
      setError((e as Error).message || 'Could not submit. Try again.');
      setSubmitting(false);
    }
  };

  const band = bandOf(totals?.pct, config.bands);

  return (
    <div className="pb-28">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/audit" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeftIcon width={16} height={16} /> Save and exit
        </Link>
        <button onClick={() => setDiscardOpen(true)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600">
          <TrashIcon width={16} height={16} /> Discard
        </button>
      </div>

      <div className="mb-5">
        <SubAreaHeader subArea={subArea} />
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="space-y-3">
        {draft.items.map((item) => (
          <ObservationCard
            key={item.obsId}
            item={item}
            showErrors={showErrors}
            photoBusy={busyObs === item.obsId}
            onScore={onScore}
            onRemark={onRemark}
            onAddPhotos={onAddPhotos}
            onRemovePhoto={onRemovePhoto}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="text-sm font-medium">
              {done} / {draft.items.length} scored
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${(done / draft.items.length) * 100}%` }} />
            </div>
          </div>
          <span className={cx('rounded-md px-2 py-1 text-sm font-semibold ring-1 ring-inset', BAND_CLASS[band])}>{formatPct(totals?.pct)}</span>
          <Button size="lg" onClick={() => setReviewOpen(true)}>
            Review
          </Button>
        </div>
      </div>

      <Modal
        open={reviewOpen}
        title={problems.length ? `${problems.length} to finish` : 'Ready to submit'}
        onClose={() => setReviewOpen(false)}
        footer={
          problems.length ? (
            <Button onClick={() => jumpTo(problems[0].obsId)}>Go to first</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setReviewOpen(false)}>Keep editing</Button>
              <Button onClick={submit} loading={submitting}>Submit audit</Button>
            </>
          )
        }
      >
        {problems.length ? (
          <ul className="divide-y divide-slate-100">
            {problems.map((i) => (
              <li key={i.obsId}>
                <button onClick={() => jumpTo(i.obsId)} className="flex w-full gap-3 py-2.5 text-left text-sm hover:bg-slate-50">
                  <AlertIcon className="mt-0.5 shrink-0 text-red-500" width={16} height={16} />
                  <span className="flex-1">
                    <span className="font-medium">{i.no}.</span> {i.text}
                    <span className="block text-xs text-red-600">{itemProblem(i) === 'score' ? 'Needs a score or NA' : 'Needs a remark'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className={cx('rounded-lg py-3 ring-1 ring-inset', BAND_CLASS[band])}>
                <div className="text-xl font-semibold">{formatPct(totals?.pct)}</div>
                <div className="text-xs">Score</div>
              </div>
              <div className="rounded-lg bg-slate-50 py-3">
                <div className="text-xl font-semibold">{totals?.belowOneCount}</div>
                <div className="text-xs text-slate-500">Findings</div>
              </div>
              <div className="rounded-lg bg-slate-50 py-3">
                <div className="text-xl font-semibold">{totals?.photoCount}</div>
                <div className="text-xs text-slate-500">Photos</div>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              {totals?.belowOneCount
                ? `${totals.belowOneCount} corrective action${totals.belowOneCount === 1 ? '' : 's'} will be sent to the area owner and manager.`
                : 'No findings. Nothing will be sent to the area owner.'}{' '}
              You can't edit the audit after submitting.
            </p>
            {!navigator.onLine && <Alert tone="info">You're offline. The audit is kept on this device and uploads when there is signal.</Alert>}
          </div>
        )}
      </Modal>

      <Modal
        open={discardOpen}
        title="Discard this audit?"
        onClose={() => setDiscardOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscardOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                window.clearTimeout(saveTimer.current);
                latest.current = null;
                await discardDraft(draft.id);
                navigate('/audit', { replace: true });
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">All scores, remarks and photos in this draft are deleted from the device.</p>
      </Modal>
    </div>
  );
}
