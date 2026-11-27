import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AuditDoc } from '@/types';
import { AuditView } from '@/components/AuditView';
import { EmptyState, FullScreenSpinner } from '@/components/ui';
import { ArrowLeftIcon } from '@/components/icons';

export default function AuditDetail({ backTo = '/audit' }: { backTo?: string }) {
  const { auditId = '' } = useParams();
  const [audit, setAudit] = useState<AuditDoc | null | undefined>(undefined);

  useEffect(() => {
    getDoc(doc(db, 'audits', auditId))
      .then((s) => setAudit(s.exists() ? (s.data() as AuditDoc) : null))
      .catch(() => setAudit(null));
  }, [auditId]);

  if (audit === undefined) return <FullScreenSpinner />;
  if (audit === null) return <EmptyState title="Audit not available" body="It may not have uploaded yet, or you don't have access." />;

  return (
    <div className="space-y-4">
      <Link to={backTo} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeftIcon width={16} height={16} /> Back
      </Link>
      <AuditView audit={audit} />
    </div>
  );
}
