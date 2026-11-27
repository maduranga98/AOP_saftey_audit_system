import { localDb, type AuditSubmission } from './localdb';
import { dateKey, monthKey } from './dates';
import type { ActionDoc, AuditDoc, AuditDraft, AuditItem, AuditTotals, ConfigMain } from '@/types';

export const APP_VERSION = '0.4.0';

export type ItemProblem = 'score' | 'remark';

/** What still blocks submit for one observation, or null when it is complete. */
export function itemProblem(item: AuditItem): ItemProblem | null {
  if (!item.na && item.score === null) return 'score';
  if ((item.na || (item.score !== null && item.score < 1)) && item.remark.trim().length < 3) return 'remark';
  return null;
}

export function remarkRequired(item: AuditItem): boolean {
  return item.na || (item.score !== null && item.score < 1);
}

export function computeTotals(items: AuditItem[]): AuditTotals {
  const scored = items.filter((i) => !i.na && i.score !== null);
  const scoredSum = scored.reduce((s, i) => s + (i.score as number), 0);
  return {
    scoredSum,
    applicable: scored.length,
    naCount: items.filter((i) => i.na).length,
    belowOneCount: scored.filter((i) => (i.score as number) < 1).length,
    photoCount: items.reduce((n, i) => n + i.photos.length, 0),
    pct: scored.length ? Math.round((scoredSum / scored.length) * 1000) / 10 : null,
  };
}

interface Auditor {
  uid: string;
  name: string;
  empNo: string;
}

/**
 * Builds the audit and its corrective actions with every name copied in, so later setup
 * changes never alter a submitted audit.
 */
export function buildSubmission(draft: AuditDraft, config: ConfigMain, auditor: Auditor): AuditSubmission {
  const sub = config.subAreas.find((s) => s.id === draft.subAreaId);
  if (!sub) throw new Error('This sub-area no longer exists. Ask the safety officer.');
  const area = config.areas.find((a) => a.id === sub.areaId);
  const person = (uid: string) => config.people.find((p) => p.uid === uid)?.name ?? 'Unknown';
  const contractor = (id: string) => config.contractors.find((c) => c.id === id)?.name ?? id;
  const assigneeIds = [...new Set([...sub.ownerIds, ...sub.managerIds])];
  const now = new Date();

  const items = draft.items.map((i) => ({ ...i, remark: i.remark.trim() }));
  const audit: AuditDoc = {
    id: draft.id,
    month: monthKey(now),
    date: dateKey(now),
    areaId: sub.areaId,
    areaName: area?.name ?? '',
    subAreaId: sub.id,
    subAreaName: sub.name,
    auditorUid: auditor.uid,
    auditorName: auditor.name,
    auditorEmpNo: auditor.empNo,
    ownerIds: sub.ownerIds,
    ownerNames: sub.ownerIds.map(person),
    managerIds: sub.managerIds,
    managerNames: sub.managerIds.map(person),
    assigneeIds,
    contractors: sub.contractors.map((c) => ({ name: contractor(c.contractorId), scope: c.scope })),
    items,
    ...computeTotals(items),
    startedAt: draft.startedAt,
    clientSubmittedAt: now.getTime(),
    appVersion: APP_VERSION,
  };

  const actions: ActionDoc[] = items
    .filter((i) => !i.na && i.score !== null && i.score < 1)
    .map((i) => ({
      id: `${draft.id}_${i.obsId}`,
      auditId: draft.id,
      month: audit.month,
      areaId: audit.areaId,
      areaName: audit.areaName,
      subAreaId: audit.subAreaId,
      subAreaName: audit.subAreaName,
      obsId: i.obsId,
      obsNo: i.no,
      obsText: i.text,
      score: i.score as ActionDoc['score'],
      remark: i.remark,
      photos: i.photos,
      raisedBy: auditor.uid,
      raisedByName: auditor.name,
      assigneeIds,
      status: 'open',
    }));

  return { audit, actions };
}

/** Moves a finished draft into the outbox in one local transaction. Nothing is lost if the app closes. */
export async function enqueueAudit(draft: AuditDraft, submission: AuditSubmission): Promise<void> {
  await localDb.transaction('rw', localDb.drafts, localDb.outbox, localDb.photos, async () => {
    await localDb.outbox.put({
      id: draft.id,
      uid: draft.uid,
      createdAt: Date.now(),
      attempts: 0,
      kind: 'audit',
      label: `${submission.audit.subAreaName} audit`,
      payload: submission,
    });
    await localDb.photos.where('draftId').equals(draft.id).modify({ draftId: null, outboxId: draft.id });
    await localDb.drafts.delete(draft.id);
  });
}
