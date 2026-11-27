import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { DATABASE_ID, db } from './shared';

/** When the safety officer voids an audit, its open corrective actions are withdrawn as "void". */
export const onAuditVoided = onDocumentUpdated({ document: 'audits/{auditId}', database: DATABASE_ID }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after?.voided || before?.voided) return;

  const open = await db.collection('actions').where('auditId', '==', event.params.auditId).where('status', '==', 'open').get();
  if (open.empty) return;
  const batch = db.batch();
  open.docs.forEach((d) => batch.update(d.ref, { status: 'void', voidReason: after.voidReason ?? '', closedAt: FieldValue.serverTimestamp() }));
  await batch.commit();
});
