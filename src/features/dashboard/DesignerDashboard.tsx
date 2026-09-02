import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle2, ClipboardList, Layers, MessageSquare, Palette, Plus,
  RefreshCw, Shirt, XCircle,
} from 'lucide-react';
import { designApi } from '../../services/manufacturing';
import { notificationApi } from '../../services/notifications';
import { ErpPageHeader, ErpButton, ErpCard, ErpDataTable, ErpStatusBadge } from '../../components/erp';
import { AlertsPanel } from './components/AlertsPanel';
import { BarStatusChart, DonutChart, FulfillmentGauge } from './components/ChartPanels';
import { recordToChart, formatNumber } from './dashboardUtils';
import type { AlertItem } from './useDashboardData';
import type { Design } from '../../types/api';
import { canCreateDesign, statusLabel } from '../design/designUtils';
import { useAuth } from '../../app/providers/AuthProvider';

function nextStep(status: string) {
  switch (status) {
    case 'DRAFT':
      return { label: 'Finish & submit', href: true };
    case 'REVISION_REQUESTED':
      return { label: 'Fix comments & resubmit', href: true };
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

const ACTION_STATUSES = new Set(['DRAFT', 'REVISION_REQUESTED', 'REJECTED']);

export function DesignerDashboard() {
  const qc = useQueryClient();
  const { permissions, user } = useAuth();
  const canCreate = canCreateDesign(permissions, !!user?.isSuperAdmin);

  const { data: stats, isLoading: statsLoading, isFetching } = useQuery({
    queryKey: ['design-stats'],
    queryFn: designApi.stats,
  });

  const { data: recentPage } = useQuery({
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

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['design-stats'] });
    qc.invalidateQueries({ queryKey: ['designs-dashboard-recent'] });
    qc.invalidateQueries({ queryKey: ['notifications-stats'] });
    qc.invalidateQueries({ queryKey: ['notifications-recent'] });
  };

  const total = stats?.total ?? 0;
  const draftOnly = stats?.draftOnly ?? 0;
  const revisions = stats?.revisionRequested ?? 0;
  const inReview = stats?.inReview ?? 0;
  const approved = stats?.approved ?? 0;
  const released = stats?.released ?? 0;
  const rejected = stats?.rejected ?? 0;
  const unread = notifyStats?.unread ?? 0;

  const kpis = [
    { label: 'My designs', value: total, link: '/designs', icon: Shirt },
    { label: 'Drafts', value: draftOnly, link: '/designs', icon: Layers },
    { label: 'Revisions', value: revisions, link: '/designs', icon: ClipboardList },
    { label: 'In review', value: inReview, link: '/designs', icon: ClipboardList },
    { label: 'Approved', value: approved, link: '/designs', icon: CheckCircle2 },
    { label: 'Released', value: released, link: '/designs', icon: CheckCircle2 },
    { label: 'Rejected', value: rejected, link: '/designs', icon: XCircle },
    { label: 'Unread alerts', value: unread, link: '/notifications', icon: Bell },
  ];

  const alerts = ([
    { id: 'revision', label: 'Revisions to fix', count: revisions, link: '/designs', severity: 'danger' },
    { id: 'draft', label: 'Drafts to finish', count: draftOnly, link: '/designs', severity: 'warning' },
    { id: 'rejected', label: 'Rejected — clone if needed', count: rejected, link: '/designs', severity: 'warning' },
    { id: 'review', label: 'Waiting in review', count: inReview, link: '/designs', severity: 'info' },
    { id: 'approved', label: 'Approved — awaiting release', count: approved, link: '/designs', severity: 'info' },
    { id: 'notify', label: 'Unread notifications', count: unread, link: '/notifications', severity: 'info' },
  ] satisfies AlertItem[]).filter((a) => a.count > 0);

  const statusChart = recordToChart(stats?.byStatus);
  const categoryChart = recordToChart(stats?.byCategory);
  const seasonChart = recordToChart(stats?.bySeason);
  const genderChart = recordToChart(stats?.byGender);
  const pulseChart = [
    { name: 'Drafts', value: draftOnly },
    { name: 'Revisions', value: revisions },
    { name: 'In review', value: inReview },
    { name: 'Approved', value: approved },
    { name: 'Released', value: released },
    { name: 'Rejected', value: rejected },
  ].filter((d) => d.value > 0);

  const designs = [...(recentPage?.items ?? [])]
    .sort((a, b) => {
      const aAct = ACTION_STATUSES.has(a.status) ? 0 : 1;
      const bAct = ACTION_STATUSES.has(b.status) ? 0 : 1;
      if (aAct !== bAct) return aAct - bAct;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    })
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <ErpPageHeader
        title="Design analytics"
        subtitle="Your styles — drafts, reviews, revisions, and what is already released to pattern."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <ErpButton variant="secondary" onClick={refresh} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
            {canCreate && (
              <Link to="/designs/new" className="erp-btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-[11px]">
                <Plus size={12} /> New design
              </Link>
            )}
          </div>
        )}
      />

      {statsLoading ? (
        <div className="erp-card flex items-center justify-center p-12">
          <p className="text-sm text-erp-text-muted">Loading design analytics…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {kpis.map(({ label, value, link, icon: Icon }) => (
              <Link key={label} to={link} className="erp-card group block p-3 transition hover:border-[var(--erp-accent)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-erp-text-muted">{label}</span>
                  <Icon className="h-3.5 w-3.5 text-erp-text-muted group-hover:text-[var(--erp-accent)]" />
                </div>
                <p className="mt-1 text-lg font-semibold">{formatNumber(value)}</p>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <FulfillmentGauge
                pct={stats?.approvalRate ?? 0}
                link="/designs"
                title="Approval rate"
                label="Approved + released vs rejected"
              />
            </div>
            <div className="lg:col-span-4">
              <AlertsPanel alerts={alerts} />
            </div>
            <div className="lg:col-span-4">
              <ErpCard className="flex h-full flex-col p-4">
                <p className="text-sm font-semibold">Released to pattern</p>
                <p className="mt-4 text-3xl font-semibold">{stats?.releaseRate ?? 0}%</p>
                <p className="mt-1 text-[10px] text-erp-text-muted">
                  {released} of {total || 0} styles have left design and are with pattern / sampling.
                </p>
                <Link to="/designs" className="mt-auto pt-4 text-[10px] text-[var(--erp-accent)] hover:underline">
                  Open my designs →
                </Link>
              </ErpCard>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DonutChart
              title="Pipeline by status"
              data={statusChart}
              link="/designs"
              centerLabel={String(total || '')}
            />
            <BarStatusChart title="Workload" data={pulseChart} link="/designs" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <BarStatusChart title="By category" data={categoryChart} link="/designs" horizontal />
            <BarStatusChart title="By season" data={seasonChart} link="/designs" horizontal />
            <DonutChart title="By gender" data={genderChart} link="/designs" />
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <ErpCard className="overflow-hidden p-0 lg:col-span-8">
              <div className="flex items-center justify-between border-b border-erp-border px-4 py-3">
                <p className="text-sm font-semibold">Recent designs</p>
                <Link to="/designs" className="text-[10px] text-[var(--erp-accent)] hover:underline">All designs →</Link>
              </div>
              <div className="overflow-x-auto">
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
                    {designs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-erp-text-muted">
                          No designs yet.{' '}
                          {canCreate && <Link to="/designs/new" className="text-[var(--erp-accent)]">Create your first style →</Link>}
                        </td>
                      </tr>
                    )}
                    {designs.map((d) => {
                      const step = nextStep(d.status);
                      return (
                        <tr key={d._id}>
                          <td>
                            <Link to={designHref(d)} className="font-mono text-xs font-medium hover:text-[var(--erp-accent)]">
                              {d.designCode}
                            </Link>
                          </td>
                          <td className="text-xs">{d.title}</td>
                          <td><ErpStatusBadge status={d.status} label={statusLabel(d.status)} /></td>
                          <td className="text-xs text-erp-text-muted">
                            {step.href ? (
                              <Link to={designHref(d)} className="text-[var(--erp-accent)] hover:underline">{step.label}</Link>
                            ) : step.label}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </ErpDataTable>
              </div>
            </ErpCard>

            <ErpCard className="p-4 lg:col-span-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Latest alerts</p>
                <Link to="/notifications" className="text-[10px] text-[var(--erp-accent)] hover:underline">All →</Link>
              </div>
              {recentNotices.length === 0 ? (
                <p className="py-6 text-center text-xs text-erp-text-muted">No notifications yet</p>
              ) : (
                <ul className="space-y-2">
                  {recentNotices.map((n) => (
                    <li key={n._id} className="rounded-lg border border-erp-border/60 px-3 py-2">
                      <p className="text-xs font-medium">{n.title}</p>
                      {n.message && <p className="mt-0.5 line-clamp-2 text-[10px] text-erp-text-muted">{n.message}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </ErpCard>
          </div>

          <ErpCard className="p-4">
            <p className="mb-3 text-sm font-semibold">Designer workspace</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: 'My designs', desc: 'Create, edit, submit tech packs', path: '/designs', icon: Palette },
                { name: 'New design', desc: 'Start a style from a blank brief', path: '/designs/new', icon: Plus },
                { name: 'Notifications', desc: 'Approvals, revisions, comments', path: '/notifications', icon: Bell },
                { name: 'Messages', desc: 'Chat with pattern and merchandising', path: '/chat', icon: MessageSquare },
              ].filter((m) => m.path !== '/designs/new' || canCreate).map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.path}
                    to={m.path}
                    className="group flex items-start gap-3 rounded-lg border border-erp-border/50 p-3 transition hover:border-[var(--erp-accent)] hover:bg-[var(--erp-accent-muted)]/20"
                  >
                    <div className="rounded-lg p-2" style={{ background: 'var(--erp-accent-muted)' }}>
                      <Icon className="h-4 w-4 text-[var(--erp-accent)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold group-hover:text-[var(--erp-accent)]">{m.name}</p>
                      <p className="text-[10px] text-erp-text-muted">{m.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ErpCard>
        </>
      )}
    </div>
  );
}
