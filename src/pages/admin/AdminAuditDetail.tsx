import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { ActionDoc, AuditDoc } from '@/types';
import { AuditView } from '@/components/AuditView';
import { ActionRow } from '@/components/ActionRow';
import { Alert, Button, Card, EmptyState, Field, FullScreenSpinner, Modal } from '@/components/ui';
import { ArrowLeftIcon, CheckIcon, ShareIcon } from '@/components/icons';

function VoidModal({ audit, onClose }: { audit: AuditDoc; onClose: () => void }) {
  const { uid } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (reason.trim().length < 5) return setError('Give a short reason.');
    setBusy(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'audits', audit.id), { voided: true, voidReason: reason.trim(), voidedBy: uid, voidedAt: serverTimestamp() });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="Void this audit?"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={busy}>Void audit</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-slate-600">Use this for an audit entered by mistake. It stays on record, marked void, and is left out of scores and exports. This can't be undone.</p>
        <Field label="Reason">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="block w-full rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-slate-900" />
        </Field>
      </div>
    </Modal>
  );
}

export default function AdminAuditDetail() {
  const { auditId = '' } = useParams();
  const [audit, setAudit] = useState<AuditDoc | null | undefined>(undefined);
  const [actions, setActions] = useState<ActionDoc[]>([]);
  const [voiding, setVoiding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'audits', auditId),
        (s) => setAudit(s.exists() ? (s.data() as AuditDoc) : null),
        () => setAudit(null),
      ),
    [auditId],
  );

  useEffect(() => {
    getDocs(query(collection(db, 'actions'), where('auditId', '==', auditId)))
      .then((s) => setActions(s.docs.map((d) => d.data() as ActionDoc).sort((a, b) => a.obsNo - b.obsNo)))
      .catch(() => setActions([]));
  }, [auditId]);

  if (audit === undefined) return <FullScreenSpinner />;
  if (audit === null) return <EmptyState title="Audit not found" action={<Link to="/admin/audits" className="text-sm font-medium underline">Back to audits</Link>} />;

  const share = async () => {
    const url = `${window.location.origin}/admin/audits/${audit.id}`;
    const title = `${audit.subAreaName} audit`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title} — ${audit.pct ?? '—'}%`, url });
        return;
      } catch {
        /* cancelled: fall back to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const open = actions.filter((a) => a.status === 'open').length;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/admin/audits" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeftIcon width={16} height={16} /> Audits
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={share}>
            {copied ? <CheckIcon width={16} height={16} /> : <ShareIcon width={16} height={16} />}
            {copied ? 'Link copied' : 'Share'}
          </Button>
          {!audit.voided && (
            <Button variant="ghost" size="sm" onClick={() => setVoiding(true)}>
              Void
            </Button>
          )}
        </div>
      </div>

      <AuditView audit={audit} />

      {actions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            Corrective actions · {open} open, {actions.length - open} closed
          </h2>
          <Card className="divide-y divide-slate-100">
            {actions.map((a) => (
              <ActionRow key={a.id} action={a} to={`/admin/actions/${a.id}`} closed={a.status === 'closed'} />
            ))}
          </Card>
        </section>
      )}

      <p className="text-xs text-slate-400">The share link opens for safety officers. Area owners and managers see their audits in their own link.</p>

      {voiding && <VoidModal audit={audit} onClose={() => setVoiding(false)} />}
    </div>
  );
}
