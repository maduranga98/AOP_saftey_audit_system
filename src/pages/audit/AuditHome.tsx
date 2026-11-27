import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SubAreaPicker } from '@/components/SubAreaPicker';

export default function AuditHome() {
  const { name } = useAuth();
  const navigate = useNavigate();
  const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{month}</p>
        <h1 className="text-xl font-semibold tracking-tight">Hello, {name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">Pick the sub-area you are auditing.</p>
      </div>
      <SubAreaPicker onPick={(s) => navigate(`/audit/sub-area/${s.id}`)} />
    </div>
  );
}
