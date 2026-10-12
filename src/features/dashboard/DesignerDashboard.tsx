import { Link, useNavigate } from 'react-router-dom';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle2, ClipboardList, FilePen, Hourglass, Palette, Plus, RefreshCw, Rocket,
  Shirt, Undo2,
} from 'lucide-react';
import { designApi } from '../../services/manufacturing';
import { notificationApi } from '../../services/notifications';
import {
  Button, EmptyRow, EmptyState, ErpDataTable, IconButton, KpiGrid, PageHeader, Section,
  Skeleton, StatTile, StatusBadge,
} from '../../components/erp';
import { AttentionList, greeting, type AttentionItem } from './components/AttentionList';
import { BarStatusChart, DonutChart } from './components/ChartPanels';
import { recordToChart, formatNumber } from './dashboardUtils';
import type { Design } from '../../types/api';
import { canCreateDesign } from '../design/designUtils';
import { relativeTime } from '../notifications/notificationsUtils';
import { useAuth } from '../../app/providers/AuthProvider';

function nextStep(status: string) {
  switch (status) {
    case 'DRAFT':
      return { label: 'Finish and submit', href: true };
    case 'REVISION_REQUESTED':
      return { label: 'Fix comments and resubmit', href: true };
    case 'IN_REVIEW':
    case 'SUBMITTED':
      return { label: 'Waiting for approval', href: false };
    case 'APPROVED':
      return { label: 'Waiting for release', href: false };
    case 'RELEASED':
      return { label: 'With pattern / sampling', href: false };
    case 'REJECTED':
      return { label: 'Clone to start again', href: true };
    default:
      return { label: 'Open design', href: true };
  }
}

function designHref(d: Design) {
  return `/designs/${d._id}/edit`;
}

// REJECTED designs can't be edited or resubmitted (only cloned), so they aren't "needs action" — matches the backend count.
const ACTION_STATUSES = new Set(['DRAFT', 'REVISION_REQUESTED']);
const QUERY_KEYS = ['design-stats', 'designs-dashboard-recent', 'notifications-stats', 'notifications-recent'];

export function DesignerDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { permissions, user } = useAuth();
  const canCreate = canCreateDesign(permissions, !!user?.isSuperAdmin);
  const fetching = useIsFetching({ predicate: (q) => QUERY_KEYS.includes(String(q.queryKey[0])) }) > 0;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['design-stats'],
    queryFn: designApi.stats,
  });

  const { data: recentPage, isLoading: recentLoading } = useQuery({
    queryKey: ['designs-dashboard-recent'],
    queryFn: () => designApi.listPage({ page: 1, limit: 50 }),
  });

  const { data: notifyStats } = useQuery({
    queryKey: ['notifications-stats'],
    queryFn: () => notificationApi.stats(),
  });

  const { data: recentNotices = [] } = useQuery({
    queryKey: ['notifications-recent', 5],
    queryFn: () => notificationApi.recent(5),
  });

  const refresh = () => QUERY_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));

  const total = stats?.total ?? 0;
  const draftOnly = stats?.draftOnly ?? 0;
  const revisions = stats?.revisionRequested ?? 0;
  const inReview = stats?.inReview ?? 0;
  const approved = stats?.approved ?? 0;
  const released = stats?.released ?? 0;
  const rejected = stats?.rejected ?? 0;
  const unread = notifyStats?.unread ?? 0;
  const decided = approved + released + rejected;

  const attention: AttentionItem[] = [
    { id: 'revision', label: 'Revisions to fix', hint: 'Reviewers asked for changes', count: revisions, link: '/designs', icon: Undo2, tone: 'danger' },
    { id: 'draft', label: 'Drafts to finish', hint: 'Not yet submitted for review', count: draftOnly, link: '/designs', icon: FilePen, tone: 'warning' },
    { id: 'notify', label: 'Unread notifications', hint: 'Comments, approvals and updates', count: unread, link: '/notifications', icon: Bell, tone: 'info' },
  ];

  const statusChart = recordToChart(stats?.byStatus);
  const categoryChart = recordToChart(stats?.byCategory);
  const seasonChart = recordToChart(stats?.bySeason);
  const genderChart = recordToChart(stats?.byGender);

  const designs = [...(recentPage?.items ?? [])]
    .sort((a, b) => {
      const aAct = ACTION_STATUSES.has(a.status) ? 0 : 1;
      const bAct = ACTION_STATUSES.has(b.status) ? 0 : 1;
      if (aAct !== bAct) return aAct - bAct;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    })
    .slice(0, 8);

  const firstName = user?.firstName?.trim();

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description="Your designs, what is waiting on you, and what has moved on to pattern."
        secondaryActions={(
          <IconButton aria-label="Refresh dashboard" outlined size="sm" onClick={refresh} loading={fetching}>
            <RefreshCw size={16} />
          </IconButton>
        )}
        primaryAction={canCreate ? (
          <Button size="sm" icon={<Plus size={16} />} onClick={() => navigate('/designs/new')}>New design</Button>
        ) : undefined}
      />

      <AttentionList items={attention} isLoading={statsLoading} />

      <div>
        <h2 className="mb-2 text-base font-semibold text-erp-text-primary">My designs</h2>
        {statsLoading ? (
          <KpiGrid cols={6}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="erp-stat-tile bg-[var(--erp-surface)] px-4 py-3.5">
                <Skeleton width="50%" />
                <Skeleton className="mt-2" width="60%" height={24} />
              </div>
            ))}
          </KpiGrid>
        ) : (
          <KpiGrid cols={6}>
            <StatTile icon={Shirt} label="All designs" value={formatNumber(total)} />
            <StatTile icon={Hourglass} label="In review" value={formatNumber(inReview)} hint="Waiting on approvers" />
            <StatTile icon={CheckCircle2} label="Approved" value={formatNumber(approved)} hint="Awaiting release" />
            <StatTile icon={Rocket} label="Released" value={formatNumber(released)} hint="With pattern / sampling" />
            <StatTile icon={ClipboardList} label="Rejected" value={formatNumber(rejected)} />
            <StatTile
              icon={Palette}
              label="Approval rate"
              value={decided > 0 ? `${stats?.approvalRate ?? 0}%` : '—'}
              hint={decided > 0 ? `${stats?.releaseRate ?? 0}% released` : 'No decisions yet'}
            />
          </KpiGrid>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Section
            title="Recent designs"
            description="Designs that need you are listed first."
            actions={<Link to="/designs" className="text-[13px] font-medium text-[var(--erp-accent)] hover:underline">All designs</Link>}
            flush
          >
            <ErpDataTable>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {recentLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 4 }).map((__, c) => <td key={c}><Skeleton width={c === 1 ? '70%' : '50%'} /></td>)}</tr>
                  ))
                ) : designs.length === 0 ? (
                  <EmptyRow
                    colSpan={4}
                    icon={Shirt}
                    title="No designs yet"
                    action={canCreate ? <Button size="sm" onClick={() => navigate('/designs/new')}>Create your first design</Button> : undefined}
                  >
                    Start a style from a brief; it appears here as you work on it.
                  </EmptyRow>
                ) : designs.map((d) => {
                  const step = nextStep(d.status);
                  return (
                    <tr key={d._id} className="erp-row-clickable" onClick={() => navigate(designHref(d))}>
                      <td className="erp-cell-primary font-mono">{d.designCode}</td>
                      <td className="max-w-[16rem] truncate">{d.title}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td className={step.href ? 'font-medium text-[var(--erp-accent)]' : 'text-erp-text-muted'}>{step.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </ErpDataTable>
          </Section>
        </div>

        <Section
          title="Latest notifications"
          actions={<Link to="/notifications" className="text-[13px] font-medium text-[var(--erp-accent)] hover:underline">View all</Link>}
          flush
          className="flex h-full flex-col"
          bodyClassName="flex-1"
        >
          {recentNotices.length === 0 ? (
            <EmptyState compact icon={Bell} title="No notifications yet" description="Approvals, revision requests and comments show up here." />
          ) : (
            <ul className="divide-y divide-[var(--erp-border)]">
              {recentNotices.map((n) => (
                <li key={n._id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-erp-text-primary">{n.title}</p>
                    <span className="shrink-0 text-xs text-erp-text-muted">{relativeTime(n.createdAt)}</span>
                  </div>
                  {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-erp-text-muted">{n.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DonutChart
          title="Pipeline by status"
          data={statusChart}
          link="/designs"
          emptyTitle="No designs yet"
          emptyDescription="Your pipeline is charted once you create designs."
        />
        <BarStatusChart title="By category" data={categoryChart} link="/designs" horizontal emptyTitle="No categories yet" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarStatusChart title="By season" data={seasonChart} link="/designs" horizontal emptyTitle="No seasons yet" />
        <DonutChart title="By gender" data={genderChart} link="/designs" emptyTitle="No designs yet" />
      </div>
    </div>
  );
}
