import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { DATABASE_ID, db } from './shared';

interface SubAreaLite {
  id: string;
  ownerIds?: string[];
  managerIds?: string[];
}

const assignees = (s: SubAreaLite) => [...new Set([...(s.ownerIds ?? []), ...(s.managerIds ?? [])])].sort();

/**
 * When the safety officer changes a sub-area's owner or manager, its open corrective actions move to
 * the new people. Closed actions and submitted audits keep who was responsible at the time.
 */
export const onConfigMainUpdated = onDocumentUpdated({ document: 'config/main', database: DATABASE_ID }, async (event) => {
  const before = (event.data?.before.get('subAreas') as SubAreaLite[] | undefined) ?? [];
  const after = (event.data?.after.get('subAreas') as SubAreaLite[] | undefined) ?? [];
  const prev = new Map(before.map((s) => [s.id, assignees(s).join()]));

  const changed = after.filter((s) => prev.has(s.id) && prev.get(s.id) !== assignees(s).join());
  if (changed.length === 0) return;

  let moved = 0;
  for (const sub of changed) {
    const ids = assignees(sub);
    const open = await db.collection('actions').where('subAreaId', '==', sub.id).where('status', '==', 'open').get();
    for (let i = 0; i < open.docs.length; i += 400) {
      const batch = db.batch();
      open.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { assigneeIds: ids }));
      await batch.commit();
    }
    moved += open.size;
  }
  logger.info(`Reassigned ${moved} open actions across ${changed.length} sub-areas.`);
});
