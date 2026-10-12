import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, Inbox, Plus, Send, Users,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { approvalApi } from '../../services/approvals';
import {
  Button, InfoBanner, KpiGrid, PageHeader, StatTile, Tabs,
} from '../../components/erp';
import { InboxTab } from './tabs/InboxTab';
import { canActOnApproval } from './approvalUtils';
import { HistoryTab } from './tabs/HistoryTab';
import { WorkflowsTab } from './tabs/WorkflowsTab';

type TabId = 'inbox' | 'history' | 'workflows';

function parseTab(t: string | null): TabId {
  return t === 'history' || t === 'workflows' ? t : 'inbox';
}

export function ApprovalsPage() {
  const { user, factoryId, permissions } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<TabId>(parseTab(tabParam));
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);

  // Deep link from the sidebar / dashboard (e.g. ?tab=workflows).
  useEffect(() => { setTab(parseTab(tabParam)); }, [tabParam]);

  const selectTab = (id: TabId) => {
    setTab(id);
    setSearchParams(id === 'inbox' ? {} : { tab: id }, { replace: true });
  };

  const { data: stats } = useQuery({
    queryKey: ['approvals-stats'],
    queryFn: approvalApi.stats,
  });

  // Same source as the sidebar badge and the dashboard's "Approvals for you": only what this
  // user can decide (their own submissions and later levels they already approved don't count).
  const { data: myPending } = useQuery({
    queryKey: ['approvals-pending', 'dashboard-mine'],
    queryFn: () => approvalApi.pending({ page: 1, limit: 50 }),
    staleTime: 60_000,
  });
  const forMe = myPending
    ? myPending.items.filter((a) => canActOnApproval(a, permissions, user?._id)).length
    : undefined;
  const factoryWide = stats?.pending;

  const { data: catalog } = useQuery({
    queryKey: ['approvals-catalog'],
    queryFn: approvalApi.catalog,
  });

  const documentTypes = catalog?.documentTypes ?? [
    'DESIGN', 'SAMPLE', 'SAMPLE_MATERIAL', 'PRODUCTION_ORDER', 'PURCHASE_REQUISITION', 'BOM',
  ];
  const approverOptions = catalog?.approverPermissions ?? [];

  const canApprove = permissions.includes('*')
    || permissions.includes('approval.approve')
    || approverOptions.some((o) => permissions.includes(o.permission));
  const canConfigure = permissions.includes('*') || permissions.includes('approval.configure');
  const canSeeUsers = permissions.includes('*') || permissions.includes('user.read');
  const overdue = stats?.overdue ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Approvals"
        description="Decide on documents waiting for you and set up approval chains."
        secondaryActions={canSeeUsers ? (
          <Button variant="secondary" size="sm" icon={<Users size={16} />} onClick={() => navigate('/users?tab=delegations')}>
            Delegations
          </Button>
        ) : undefined}
        primaryAction={tab === 'workflows' && canConfigure ? (
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setCreatingWorkflow(true)}>New workflow</Button>
        ) : undefined}
      />

      <KpiGrid cols={4}>
        <StatTile
          icon={Inbox}
          label="Waiting for you"
          value={forMe ?? '—'}
          hint={factoryWide != null && forMe != null && factoryWide !== forMe ? `${factoryWide} in total` : undefined}
        />
        <StatTile
          icon={AlertTriangle}
          label="Over SLA"
          value={stats?.overdue ?? '—'}
          hint="Past target time"
          highlight={overdue > 0 ? 'warn' : undefined}
        />
        <StatTile icon={Send} label="My requests" value={stats?.submittedByMe ?? "—"} hint="Still in approval" />
        <StatTile icon={CheckCircle2} label="Decided today" value={stats?.completedToday ?? '—'} />
      </KpiGrid>

      {!canApprove && tab === 'inbox' && (
        <InfoBanner inset={false} tone="muted">
          You can follow approvals here, but deciding needs an approve permission for that document type.
        </InfoBanner>
      )}

      <Tabs
        tabs={[
          { id: 'inbox', label: 'Inbox', count: forMe ?? null },
          { id: 'history', label: 'History' },
          { id: 'workflows', label: 'Workflows' },
        ]}
        active={tab}
        onChange={(id) => selectTab(id as TabId)}
        ariaLabel="Approvals views"
      />

      {tab === 'inbox' && (
        <InboxTab
          canApprove={canApprove}
          permissions={permissions}
          userId={user?._id}
          documentTypes={documentTypes}
        />
      )}
      {tab === 'history' && <HistoryTab documentTypes={documentTypes} />}
      {tab === 'workflows' && (
        <WorkflowsTab
          canConfigure={canConfigure}
          documentTypes={documentTypes}
          approverOptions={approverOptions}
          organizationId={user?.organizationId}
          factoryId={factoryId ?? undefined}
          createOpen={creatingWorkflow}
          onCreateOpenChange={setCreatingWorkflow}
        />
      )}
    </div>
  );
}
