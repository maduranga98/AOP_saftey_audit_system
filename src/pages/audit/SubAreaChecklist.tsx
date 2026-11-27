import { Link, useParams } from 'react-router-dom';
import { useConfig } from '@/contexts/ConfigContext';
import { SubAreaHeader } from '@/components/SubAreaHeader';
import { Alert, Card, EmptyState } from '@/components/ui';

/**
 * Phase 1: read-only view of a sub-area's checklist so the imported data can be checked on site.
 * Phase 2 replaces this with the scoring form.
 */
export default function SubAreaChecklist() {
  const { subAreaId = '' } = useParams();
  const { subAreaById, observationsOf } = useConfig();
  const subArea = subAreaById.get(subAreaId);

  if (!subArea) return <EmptyState title="Sub-area not found" action={<Link to="/audit" className="text-sm font-medium underline">Back</Link>} />;
  const items = observationsOf(subArea.id);

  return (
    <div className="space-y-5">
      <Link to="/audit" className="text-sm text-slate-500 hover:text-slate-900">← All sub-areas</Link>
      <SubAreaHeader subArea={subArea} />
      <Alert tone="info">Scoring opens in the next release. Check that this list matches the current checklist.</Alert>
      <Card>
        <ol className="divide-y divide-slate-100">
          {items.map((o, i) => (
            <li key={o.id} className="flex gap-3 px-4 py-3 text-sm">
              <span className="w-6 shrink-0 font-medium text-slate-400">{i + 1}</span>
              <span>{o.text}</span>
            </li>
          ))}
        </ol>
      </Card>
      <p className="text-center text-xs text-slate-400">{items.length} observations</p>
    </div>
  );
}
