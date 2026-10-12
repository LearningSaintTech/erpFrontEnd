import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Ban, CheckCircle2, ClipboardList, Eye, MessageSquareReply, Pencil, Plus, Send, Wallet, XCircle,
} from 'lucide-react';
import {
  Badge, Button, DescriptionList, Drawer, ErpDataTable, ErpSelect, FilterBar, InfoBanner, RowActionsMenu,
  SearchInput, StatusBadge, StepFlow, TablePager, type Step,
} from '../../components/erp';
import type { LucideIcon } from 'lucide-react';
import { QueryState } from '../../components/QueryState';
import { approvalApi } from '../../services/approvals';
import { purchaseApi } from '../../services/operations';
import type { ApprovalInstance, GoodsReceipt, PurchaseOrder, PurchaseRequisition } from '../../types/api';
import { blockedReason, canActOnApproval, requiredApproverLabel, requiredApproverPermissions, workflowLevelLabel } from '../approvals/approvalUtils';
import { unitLabel } from '../inventory/inventoryUtils';
import {
  findGrnsForPo, findPoForPr, formatCurrency, historyPurchaseLabel, materialLabel, prSourceLabel, supplierLabel,
} from './purchaseUtils';
import {
  formatDate, LinesList, lineQty, PURCHASE_PAGE_SIZE, type PurchasePerms,
} from './purchaseShared';
import { usePurchaseDialogs, type WorkflowAction } from './purchaseActions';

/** Fields the purchase API returns that the shared types don't declare yet. */
export type PrRow = PurchaseRequisition & { revisionComments?: string; rejectionComments?: string; sourceType?: string };

export const PR_STATUS_FILTERS = [
  { value: 'DRAFT,SUBMITTED,APPROVED,REJECTED', label: 'All open' },
  { value: 'SUBMITTED', label: 'Awaiting approval' },
  { value: 'APPROVED', label: 'Ready for payment' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export function prEstValue(pr: PurchaseRequisition) {
  return (pr.lines || []).reduce((s, l) => s + lineQty(l) * (l.estimatedUnitCost ?? 0), 0);
}

export type MoreItem = { label: string; icon: LucideIcon; danger?: boolean; hidden?: boolean; onSelect: () => void };

type PrActionCtx = {
  perms: PurchasePerms;
  approval?: ApprovalInstance;
  run: (a: WorkflowAction) => void;
  dialogs: ReturnType<typeof usePurchaseDialogs>;
  onCreatePayment: (prId: string) => void;
  onEdit: (pr: PrRow) => void;
};

/** Primary contextual action + the rest, shared by the table row and the detail drawer. */
function prActions(pr: PrRow, ctx: PrActionCtx) {
  const { perms, approval, run, dialogs } = ctx;
  const canActLevel = approval ? canActOnApproval(approval, perms.permissions, perms.userId) : perms.canApprovePr;
  const editable = pr.status === 'DRAFT' || pr.status === 'REJECTED';
  // Sent back / rejected: the natural next step is to revise it, so "Edit" leads.
  const needsRevision = pr.status === 'REJECTED' || !!pr.revisionComments;
  const submit = {
    label: needsRevision ? 'Resubmit as is' : 'Submit',
    icon: <Send size={14} />,
    onClick: () => run({ type: 'submitPr', id: pr._id, number: pr.prNumber }),
  };
  const edit = { label: needsRevision ? 'Edit & resubmit' : 'Edit', icon: <Pencil size={14} />, onClick: () => ctx.onEdit(pr) };
  let primary: { label: string; icon: ReactNode; onClick: () => void } | null = null;
  if (editable && perms.canUpdate) {
    primary = needsRevision ? edit : submit;
  } else if (pr.status === 'SUBMITTED' && canActLevel) {
    primary = { label: 'Approve', icon: <CheckCircle2 size={14} />, onClick: () => run({ type: 'approvePr', id: pr._id, number: pr.prNumber }) };
  } else if (pr.status === 'APPROVED' && perms.canExecute) {
    primary = { label: 'Create payment', icon: <Wallet size={14} />, onClick: () => ctx.onCreatePayment(pr._id) };
  }
  const more: MoreItem[] = [
    { label: edit.label, icon: Pencil, hidden: !(editable && perms.canUpdate) || primary === edit, onSelect: edit.onClick },
    { label: submit.label, icon: Send, hidden: !(editable && perms.canUpdate) || primary === submit, onSelect: submit.onClick },
    { label: 'Request changes', icon: MessageSquareReply, hidden: !(pr.status === 'SUBMITTED' && canActLevel), onSelect: () => dialogs.requestChanges(pr) },
    { label: 'Reject', icon: XCircle, danger: true, hidden: !(pr.status === 'SUBMITTED' && canActLevel), onSelect: () => dialogs.rejectPr(pr) },
    { label: 'Cancel requisition', icon: Ban, danger: true, hidden: !(editable && perms.canUpdate), onSelect: () => dialogs.cancelPr(pr) },
  ];
  const waiting = pr.status === 'SUBMITTED' && !canActLevel;
  return { primary, more, canActLevel, waiting };
}

function prHint(pr: PrRow, approval?: ApprovalInstance, viewer?: { permissions: string[]; userId?: string }): ReactNode {
  if (pr.status === 'DRAFT' && pr.revisionComments) {
    return <span className="text-[var(--erp-warning-text)]">Changes requested: {pr.revisionComments}</span>;
  }
  if (pr.status === 'REJECTED' && pr.rejectionComments) {
    return <span className="text-[var(--erp-danger-text)]">Reason: {pr.rejectionComments}</span>;
  }
  if (pr.status === 'SUBMITTED') {
    if (!approval) return 'Waiting for factory admin';
    // Only multi-level chains need the level; "Level 1 of 1" is noise.
    const levelLabel = workflowLevelLabel(approval);
    const prefix = /of 1$/.test(levelLabel) ? '' : `${levelLabel} · `;
    const perms = viewer?.permissions ?? [];
    const isApprover = perms.includes('*') || requiredApproverPermissions(approval).some((p) => perms.includes(p));
    // Requesters just need to know who has it; approvers who can't act need to know why.
    if (!isApprover) return `${prefix}Waiting for ${requiredApproverLabel(approval)}`;
    const blocked = viewer && !canActOnApproval(approval, viewer.permissions, viewer.userId);
    return `${prefix}${blocked ? blockedReason(approval, viewer?.userId) : `Needs ${requiredApproverLabel(approval)}`}`;
  }
  if (pr.status === 'APPROVED') return 'Ready for payment';
  if (pr.status === 'DRAFT') return 'Not submitted yet';
  return null;
}

export function usePrApprovals(enabled: boolean) {
  const { data = [] } = useQuery({
    queryKey: ['approvals-pending-pr'],
    queryFn: () => approvalApi.pending({ documentType: 'PURCHASE_REQUISITION', limit: 100 }).then((r) => r.items),
    enabled,
  });
  return useMemo(() => {
    const map = new Map<string, ApprovalInstance>();
    for (const inst of data) map.set(String(inst.documentId), inst);
    return map;
  }, [data]);
}

export function RequisitionsTab({
  perms, status, onStatus, search, onSearch, page, onPage, highlightId, selectedId, onSelect,
  onNewPr, onCreatePayment, onEdit, run,
}: {
  perms: PurchasePerms;
  status: string;
  onStatus: (s: string) => void;
  search: string;
  onSearch: (s: string) => void;
  page: number;
  onPage: (p: number) => void;
  highlightId?: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNewPr: () => void;
  onCreatePayment: (prId: string) => void;
  onEdit: (pr: PrRow) => void;
  run: (a: WorkflowAction) => void;
}) {
  const dialogs = usePurchaseDialogs(run);
  const approvals = usePrApprovals(perms.canReadApprovals);

  const list = useQuery({
    queryKey: ['purchase-list', 'pr', page, search, status],
    queryFn: () => purchaseApi.listPRsPage({ page, limit: PURCHASE_PAGE_SIZE, search: search || undefined, status }),
  });
  const rows = (list.data?.items ?? []) as PrRow[];
  const meta = list.data?.meta;
  const filtered = !!search || status !== PR_STATUS_FILTERS[0].value;
  const selected = rows.find((r) => r._id === selectedId) ?? null;

  return (
    <>
      <FilterBar
        search={<SearchInput value={search} onChange={onSearch} placeholder="Search PR number…" inputSize="sm" />}
        filters={(
          <ErpSelect inputSize="sm" value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Status">
            {PR_STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </ErpSelect>
        )}
        onClear={filtered ? () => { onSearch(''); onStatus(PR_STATUS_FILTERS[0].value); } : undefined}
      />
      <QueryState
        skeleton="table"
        skeletonColumns={5}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        isEmpty={!rows.length}
        emptyIcon={ClipboardList}
        emptyMessage={filtered ? 'No requisitions match these filters' : 'No open requisitions'}
        emptyDescription={filtered ? 'Try another status or clear the search.' : 'Raise a requisition when the store needs materials.'}
        emptyAction={filtered
          ? <Button size="sm" variant="secondary" onClick={() => { onSearch(''); onStatus(PR_STATUS_FILTERS[0].value); }}>Clear filters</Button>
          : perms.canCreate ? <Button size="sm" icon={<Plus size={16} />} onClick={onNewPr}>New requisition</Button> : undefined}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th>Requisition</th>
                <th>Items</th>
                <th className="erp-num">Est. value</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pr) => {
                const approval = approvals.get(pr._id);
                const a = prActions(pr, { perms, approval, run, dialogs, onCreatePayment, onEdit });
                const hint = prHint(pr, approval, { permissions: perms.permissions, userId: perms.userId });
                const sel = selectedId === pr._id || highlightId === pr._id;
                return (
                  <tr key={pr._id} className={`erp-row-clickable${sel ? ' erp-row-selected' : ''}`} onClick={() => onSelect(pr._id)}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="erp-cell-primary font-mono">{pr.prNumber}</span>
                        {pr.sourceType === 'MRP' && <Badge tone="info" dot={false}>MRP</Badge>}
                      </div>
                      <p className="text-xs text-erp-text-muted">{formatDate(pr.createdAt)}</p>
                    </td>
                    <td><LinesList lines={pr.lines} /></td>
                    <td className="erp-num">{formatCurrency(prEstValue(pr))}</td>
                    <td className="max-w-[260px]">
                      <StatusBadge status={pr.status} />
                      {hint && <p className="mt-1 line-clamp-2 text-xs leading-snug text-erp-text-muted">{hint}</p>}
                    </td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {a.primary && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={a.primary.icon}
                            onClick={(e) => { e.stopPropagation(); a.primary?.onClick(); }}
                          >
                            {a.primary.label}
                          </Button>
                        )}
                        <RowActionsMenu items={[{ label: 'View details', icon: Eye, onSelect: () => onSelect(pr._id) }, ...a.more]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        </div>
        {meta && (
          <TablePager
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={PURCHASE_PAGE_SIZE}
            itemLabel="requisitions"
            onPrev={() => onPage(page - 1)}
            onNext={() => onPage(page + 1)}
          />
        )}
      </QueryState>

      <PrDetailDrawer
        pr={selected}
        onClose={() => onSelect(null)}
        actionCtx={{ perms, approval: selected ? approvals.get(selected._id) : undefined, run, dialogs, onCreatePayment, onEdit }}
      />
    </>
  );
}

const PR_STEPS = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PAYMENT', 'RECEIVED'] as const;

function prSteps(pr: PrRow, linkedPo?: PurchaseOrder, grns: GoodsReceipt[] = []): { steps: Step[]; current: string } {
  const received = grns.some((g) => g.status === 'COMPLETED');
  const current = pr.status === 'CONVERTED'
    ? (received ? 'RECEIVED' : 'PAYMENT')
    : pr.status === 'REJECTED' || pr.status === 'CANCELLED' ? 'SUBMITTED' : pr.status;
  const blocked = pr.status === 'REJECTED' || pr.status === 'CANCELLED';
  const labels: Record<(typeof PR_STEPS)[number], string> = {
    DRAFT: 'Draft', SUBMITTED: blocked ? (pr.status === 'REJECTED' ? 'Rejected' : 'Cancelled') : 'Approval', APPROVED: 'Approved', PAYMENT: 'Payment', RECEIVED: 'Received',
  };
  const steps: Step[] = PR_STEPS.map((id) => ({
    id,
    label: labels[id],
    description: id === 'PAYMENT' && linkedPo ? linkedPo.poNumber : undefined,
    ...(blocked && id === 'SUBMITTED' ? { state: 'blocked' as const } : {}),
    ...(received && id === 'RECEIVED' ? { state: 'done' as const } : {}),
  }));
  return { steps, current };
}

/** Requisition detail: progress, lines, linked payment and receipts, actions in the footer. */
export function PrDetailDrawer({
  pr, onClose, actionCtx,
}: {
  pr: PrRow | null;
  onClose: () => void;
  actionCtx?: PrActionCtx;
}) {
  const open = !!pr;
  const needsLinks = open && (pr?.status === 'CONVERTED' || pr?.status === 'APPROVED');
  const { data: pos = [] } = useQuery({
    queryKey: ['pos-pr-link'],
    queryFn: () => purchaseApi.listPOs({ limit: 500 }),
    enabled: needsLinks,
  });
  const { data: grns = [] } = useQuery({
    queryKey: ['grns-history-link'],
    queryFn: () => purchaseApi.listGRNs({ limit: 500 }),
    enabled: needsLinks,
  });
  if (!pr) return <Drawer open={false} onClose={onClose} title="" />;

  const linkedPo = findPoForPr(pos, pr);
  const linkedGrns = linkedPo ? findGrnsForPo(grns, linkedPo._id) : [];
  const { steps, current } = prSteps(pr, linkedPo, linkedGrns);
  const a = actionCtx ? prActions(pr, actionCtx) : null;
  const visibleMore = (a?.more ?? []).filter((m) => !m.hidden);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={pr.prNumber}
      description={`${prSourceLabel(pr)} requisition · created ${formatDate(pr.createdAt)}`}
      headerExtra={<StatusBadge status={pr.status} />}
      footer={a && (a.primary || visibleMore.length) ? (
        <>
          {visibleMore.map((m, i) => (
            <Button
              key={m.label}
              variant={m.danger ? 'danger' : 'secondary'}
              className={i === 0 ? 'mr-auto' : undefined}
              onClick={m.onSelect}
            >
              {m.label}
            </Button>
          ))}
          {a.primary && <Button icon={a.primary.icon} onClick={a.primary.onClick}>{a.primary.label}</Button>}
        </>
      ) : undefined}
    >
      <div className="space-y-5">
        <StepFlow steps={steps} current={current} size="sm" />

        {pr.status === 'DRAFT' && pr.revisionComments && (
          <InfoBanner inset={false} tone="warn" title="Changes requested">{pr.revisionComments}</InfoBanner>
        )}
        {pr.status === 'REJECTED' && pr.rejectionComments && (
          <InfoBanner inset={false} tone="danger" title="Rejected">{pr.rejectionComments}</InfoBanner>
        )}

        <DescriptionList
          columns={2}
          items={[
            { label: 'Source', value: prSourceLabel(pr) },
            { label: 'Estimated value', value: <span className="erp-tabular">{formatCurrency(prEstValue(pr))}</span> },
            {
              label: 'Approval',
              value: actionCtx?.approval ? `${workflowLevelLabel(actionCtx.approval)} · needs ${requiredApproverLabel(actionCtx.approval)}` : undefined,
              hidden: pr.status !== 'SUBMITTED' || !actionCtx?.approval,
            },
            {
              label: 'Payment',
              value: linkedPo ? `${linkedPo.poNumber} · ${supplierLabel(linkedPo.supplierId)} · ${formatCurrency(linkedPo.totalAmount)}` : undefined,
              hidden: !linkedPo,
              full: true,
            },
            {
              label: 'Progress',
              value: historyPurchaseLabel(linkedPo, linkedGrns),
              hidden: pr.status !== 'CONVERTED',
              full: true,
            },
          ]}
        />

        <div>
          <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Items</h3>
          <div className="erp-table-wrap rounded-lg border border-[var(--erp-border)]">
            <ErpDataTable className="w-full">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="erp-num">Qty</th>
                  <th className="erp-num">Est. unit cost</th>
                  <th className="erp-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(pr.lines || []).map((l, i) => (
                  <tr key={i}>
                    <td className="min-w-[160px]">{materialLabel(l.materialId)}</td>
                    <td className="erp-num">{lineQty(l).toLocaleString()} {unitLabel(l.unit)}</td>
                    <td className="erp-num">{formatCurrency(l.estimatedUnitCost ?? 0)}</td>
                    <td className="erp-num">{formatCurrency(lineQty(l) * (l.estimatedUnitCost ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </div>
        </div>

        {linkedGrns.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Goods receipts</h3>
            <ul className="divide-y divide-[var(--erp-border)] rounded-lg border border-[var(--erp-border)]">
              {linkedGrns.map((g) => (
                <li key={g._id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="font-mono text-[13px] font-medium">{g.grnNumber}</span>
                  <StatusBadge status={g.status} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {a?.waiting && (
          <p className="text-[13px] text-erp-text-muted">
            Waiting for another approver. <Link to="/approvals" className="font-medium text-[var(--erp-accent)] hover:underline">Open approvals inbox</Link>
          </p>
        )}
      </div>
    </Drawer>
  );
}
