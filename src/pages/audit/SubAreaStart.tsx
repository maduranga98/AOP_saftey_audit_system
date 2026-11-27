import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { localDb } from '@/lib/localdb';
import { openDraft } from '@/lib/drafts';
import { SubAreaHeader } from '@/components/SubAreaHeader';
import { Alert, Button, Card, EmptyState } from '@/components/ui';
import { ArrowLeftIcon } from '@/components/icons';

/** Sub-area summary with Start / Continue. The checklist can be previewed before starting. */
export default function SubAreaStart() {
  const { subAreaId = '' } = useParams();
  const { uid } = useAuth();
  const { subAreaById, observationsOf, checklists } = useConfig();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const subArea = subAreaById.get(subAreaId);
  const draft = useLiveQuery(
    () => (uid ? localDb.drafts.where('subAreaId').equals(subAreaId).filter((d) => d.uid === uid).first() : undefined),
    [uid, subAreaId],
  );

  if (!subArea) return <EmptyState title="Sub-area not found" action={<Link to="/audit" className="text-sm font-medium underline">Back</Link>} />;
  const observations = observationsOf(subArea.id);
  const scored = draft ? draft.payload.items.filter((i) => i.na || i.score !== null).length : 0;

  const start = async () => {
    if (!uid) return;
    setBusy(true);
    const d = await openDraft(uid, subArea.id, observations);
    navigate(`/audit/form/${d.id}`);
  };

  return (
    <div className="space-y-5">
      <Link to="/audit" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeftIcon width={16} height={16} /> All sub-areas
      </Link>
      <SubAreaHeader subArea={subArea} />

      {!checklists ? (
        <Alert tone="info">Checklist still loading. Connect once so this device can download it.</Alert>
      ) : observations.length === 0 ? (
        <Alert>This sub-area has no observations. Ask the safety officer.</Alert>
      ) : (
        <Button size="lg" className="w-full" onClick={start} loading={busy}>
          {draft ? `Continue audit · ${scored} / ${draft.payload.items.length} scored` : `Start audit · ${observations.length} observations`}
        </Button>
      )}

      {observations.length > 0 && (
        <div>
          <button onClick={() => setPreview((v) => !v)} className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline">
            {preview ? 'Hide checklist' : 'Preview checklist'}
          </button>
          {preview && (
            <Card className="mt-3">
              <ol className="divide-y divide-slate-100">
                {observations.map((o, i) => (
                  <li key={o.id} className="flex gap-3 px-4 py-3 text-sm">
                    <span className="w-6 shrink-0 font-medium text-slate-400">{i + 1}</span>
                    <span>{o.text}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
