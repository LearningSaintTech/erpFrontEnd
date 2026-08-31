import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Inbox, Link2 } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { approvalApi } from '../../services/approvals';
import { ErpPageHeader, ErpCard, ErpTabs } from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { InboxTab } from './tabs/InboxTab';
import { HistoryTab } from './tabs/HistoryTab';
import { WorkflowsTab } from './tabs/WorkflowsTab';

type TabId = 'inbox' | 'history' | 'workflows';

export function ApprovalsPage() {
  const { user, factoryId, permissions } = useAuth();
  const [tab, setTab] = useState<TabId>('inbox');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['approvals-stats'],
    queryFn: approvalApi.stats,
  });

  const { data: catalog } = useQuery({
    queryKey: ['approvals-catalog'],
    queryFn: approvalApi.catalog,
  });

  const documentTypes = catalog?.documentTypes ?? [
    'DESIGN', 'SAMPLE', 'SAMPLE_MATERIAL', 'PRODUCTION_ORDER', 'PURCHASE_REQUISITION', 'PURCHASE_ORDER', 'BOM',
  ];
  const approverOptions = catalog?.approverPermissions ?? [];

  const canApprove = permissions.includes('*')
    || permissions.includes('approval.approve')
    || approverOptions.some((o) => permissions.includes(o.permission));
  const canConfigure = permissions.includes('*') || permissions.includes('approval.configure');

  const tabs = useMemo(() => [
    { id: 'inbox', label: `Inbox${stats?.pending != null ? ` (${stats.pending})` : ''}` },
    { id: 'history', label: 'History' },
    { id: 'workflows', label: 'Workflows' },
  ], [stats?.pending]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="approvals-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Approvals"
        subtitle={(
          <>
            Central inbox for design, production, purchase, and sample sign-offs.
            <Link to="/users" className="ml-2 inline-flex items-center gap-0.5 text-[var(--erp-accent)]">
              <Link2 size={10} /> Delegations in Users
            </Link>
          </>
        )}
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Pending</p>
              <p className="text-lg font-semibold">{stats?.pending ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Over SLA (24h)</p>
              <p className={`text-lg font-semibold ${(stats?.overdue ?? 0) > 0 ? 'text-amber-600' : ''}`}>
                {stats?.overdue ?? '—'}
              </p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">My submissions</p>
              <p className="text-lg font-semibold">{stats?.submittedByMe ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Completed today</p>
              <p className="text-lg font-semibold">{stats?.completedToday ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
      </div>

      {!canApprove && (
        <ErpCard className="mb-3 !border-amber-500/30 !bg-amber-500/5 !p-3">
          <p className="text-[11px]" style={{ color: 'var(--erp-warning-text)' }}>
            You have read-only access. Approval actions require a document-specific approve permission
            (e.g. <code className="text-[10px]">sampling.approve</code> for sample materials).
          </p>
        </ErpCard>
      )}

      <ErpTabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />

      <div className="mt-3">
        {tab === 'inbox' && (
          <InboxTab
            canApprove={canApprove}
            permissions={permissions}
            userId={user?._id}
            documentTypes={documentTypes}
            onError={setError}
            onSuccess={showSuccess}
          />
        )}
        {tab === 'history' && (
          <HistoryTab documentTypes={documentTypes} />
        )}
        {tab === 'workflows' && (
          <WorkflowsTab
            canConfigure={canConfigure}
            documentTypes={documentTypes}
            approverOptions={approverOptions}
            organizationId={user?.organizationId}
            factoryId={factoryId ?? undefined}
            onError={setError}
            onSuccess={showSuccess}
          />
        )}
      </div>
    </div>
  );
}
