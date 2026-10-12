import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck, Download, FilePen, PackageCheck, Plus, Send, ShieldCheck, Wallet, WalletCards,
} from 'lucide-react';
import { purchaseApi } from '../../services/operations';
import {
  Button, InfoBanner, KpiGrid, PageHeader, Section, StatTile, Tabs, humanizeStatus, toast,
} from '../../components/erp';
import type { GoodsReceipt, PurchaseOrder, PurchaseRequisition } from '../../types/api';
import { downloadCsv, fetchAllPages } from '../../utils/csvExport';
import { formatCurrency, grnLineSummary, lineSummary, poNumber, supplierLabel } from './purchaseUtils';
import { useDebounced, usePurchasePerms } from './purchaseShared';
import { usePurchaseWorkflow } from './purchaseActions';
import { PR_STATUS_FILTERS, RequisitionsTab, prEstValue } from './RequisitionsTab';
import { PO_STATUS_FILTERS, PaymentsTab } from './PaymentsTab';
import { GRN_STATUS_FILTERS, ReceiptsTab } from './ReceiptsTab';
import { HistoryTab } from './HistoryTab';
import { PrFormDrawer, type EditablePr } from './PrFormDrawer';
import { PaymentFormDrawer } from './PaymentFormDrawer';
import { GrnFormDrawer } from './GrnFormDrawer';
import { SupplierFormDrawer, SuppliersPanel } from './VendorsPage';

type TabId = 'pr' | 'po' | 'grn' | 'suppliers' | 'history';
const TAB_IDS: TabId[] = ['pr', 'po', 'grn', 'suppliers', 'history'];

export function PurchasePage() {
  const perms = usePurchasePerms();
  const workflow = usePurchaseWorkflow();
  const run = workflow.mutate;
  const [searchParams, setSearchParams] = useSearchParams();

  // Finance-only users land on unpaid payments; everyone else on requisitions.
  const financeOnly = perms.canMarkPaid && !perms.canCreate;
  const [tab, setTab] = useState<TabId>(() => {
    const q = searchParams.get('tab');
    if (q === 'rfq') return 'po';
    if (q && (TAB_IDS as string[]).includes(q)) return q as TabId;
    return financeOnly ? 'po' : 'pr';
  });
  const [prStatus, setPrStatus] = useState<string>(PR_STATUS_FILTERS[0].value);
  const [poStatus, setPoStatus] = useState<string>(PO_STATUS_FILTERS[0].value);
  const [poPay, setPoPay] = useState(financeOnly ? 'UNPAID' : '');
  const [grnStatus, setGrnStatus] = useState<string>(GRN_STATUS_FILTERS[0].value);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput.trim());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [prFormOpen, setPrFormOpen] = useState(false);
  const [editingPr, setEditingPr] = useState<EditablePr | null>(null);
  const [paymentForm, setPaymentForm] = useState<{ open: boolean; prId?: string }>({ open: false });
  const [grnForm, setGrnForm] = useState<{ open: boolean; poId?: string }>({ open: false });
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [supplierFocus, setSupplierFocus] = useState<string | null>(null);

  // Deep links (?tab=grn from other modules) keep working after mount.
  useEffect(() => {
    const q = searchParams.get('tab');
    const next = q === 'rfq' ? 'po' : q;
    if (next && (TAB_IDS as string[]).includes(next) && next !== tab) setTab(next as TabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => { setPage(1); }, [search, prStatus, poStatus, poPay, grnStatus]);

  const { data: stats } = useQuery({ queryKey: ['purchase-stats'], queryFn: () => purchaseApi.stats() });
  const unpaidValue = (stats as { unpaidValue?: number } | undefined)?.unpaidValue ?? stats?.openPoValue;

  const goTab = (id: TabId, opts?: { keepSearch?: boolean }) => {
    setTab(id);
    setPage(1);
    setSelectedId(null);
    if (!opts?.keepSearch) setSearchInput('');
    const p = new URLSearchParams(searchParams);
    if (id === 'pr') p.delete('tab'); else p.set('tab', id);
    setSearchParams(p, { replace: true });
  };

  const flash = (id: string) => {
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 5000);
  };

  const openPayment = (prId?: string) => setPaymentForm({ open: true, prId });
  const openGrn = (poId?: string) => setGrnForm({ open: true, poId });

  const exportCurrent = async () => {
    // Export exactly what the current tab lists: same status / payment / search filters as the table
    // (all pages, not just the visible one), with readable statuses and names instead of raw enums.
    // The tables filter on the raw input (not the debounced value) — export the same rows even right after typing.
    const term = searchInput.trim() || undefined;
    const isoDate = (v?: string) => (v ? new Date(v).toISOString().slice(0, 10) : '');
    try {
      if (tab === 'po') {
        const defaultStatus = PO_STATUS_FILTERS[0].value;
        const items = await fetchAllPages((p) => purchaseApi.listPOsPage({
          ...p, search: term, ...(term && poStatus === defaultStatus ? {} : { status: poStatus }), paymentStatus: poPay || undefined,
        }));
        downloadCsv('purchase-payments.csv', ['Payment', 'Date', 'Supplier', 'Status', 'Payment status', 'Amount', 'Items'], items.map((p: PurchaseOrder) => [
          p.poNumber, isoDate(p.createdAt), supplierLabel(p.supplierId), humanizeStatus(p.status),
          p.status === 'CANCELLED' ? '' : (p.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'), p.totalAmount ?? 0, lineSummary(p.lines),
        ]));
      } else if (tab === 'grn') {
        const defaultStatus = GRN_STATUS_FILTERS[0].value;
        const items = await fetchAllPages((p) => purchaseApi.listGRNsPage({
          ...p, search: term, ...(term && grnStatus === defaultStatus ? {} : { status: grnStatus }),
        }));
        downloadCsv('goods-receipts.csv', ['Receipt', 'Date', 'Payment', 'Status', 'Items', 'Invoices'], items.map((g: GoodsReceipt) => [
          g.grnNumber, isoDate((g as GoodsReceipt & { createdAt?: string }).createdAt), poNumber(g.poId as string | PurchaseOrder | undefined), humanizeStatus(g.status),
          grnLineSummary(g as Parameters<typeof grnLineSummary>[0]), g.receipts?.length ?? 0,
        ]));
      } else {
        const items = await fetchAllPages((p) => purchaseApi.listPRsPage({ ...p, search: term, status: tab === 'history' ? 'CONVERTED' : prStatus }));
        downloadCsv(tab === 'history' ? 'purchase-history.csv' : 'purchase-requisitions.csv', ['Requisition', 'Date', 'Status', 'Est. value', 'Items'], items.map((p: PurchaseRequisition) => [
          p.prNumber, isoDate(p.createdAt), humanizeStatus(p.status), Math.round(prEstValue(p)), lineSummary(p.lines),
        ]));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const prOpenCount = (stats?.prDraft ?? 0) + (stats?.prSubmitted ?? 0) + (stats?.prApproved ?? 0);
  const grnOpenCount = (stats?.grnDraft ?? 0) + (stats?.grnPendingQc ?? 0);

  const primaryAction = (() => {
    if (tab === 'po') {
      return perms.canExecute ? <Button icon={<Wallet size={16} />} onClick={() => openPayment()}>Create payment</Button> : null;
    }
    if (tab === 'grn') {
      return perms.canReceive ? <Button icon={<PackageCheck size={16} />} onClick={() => openGrn()}>Receive goods</Button> : null;
    }
    if (tab === 'suppliers') {
      return perms.canExecute ? <Button icon={<Plus size={16} />} onClick={() => setSupplierFormOpen(true)}>New supplier</Button> : null;
    }
    return perms.canCreate ? <Button icon={<Plus size={16} />} onClick={() => setPrFormOpen(true)}>New requisition</Button> : null;
  })();

  const allTiles = [
    {
      key: 'drafts', icon: FilePen, label: 'My drafts', value: stats?.prDraft,
      hint: 'Requisitions not submitted yet',
      warn: perms.canCreate && (stats?.prDraft ?? 0) > 0,
      active: tab === 'pr' && prStatus === 'DRAFT',
      onClick: () => { goTab('pr'); setPrStatus('DRAFT'); },
    },
    {
      key: 'receipts', icon: Send, label: 'Receipts to submit', value: stats?.grnDraft,
      hint: 'Goods received — send them to QC',
      warn: perms.canUpdate && (stats?.grnDraft ?? 0) > 0,
      active: tab === 'grn' && grnStatus === 'DRAFT',
      onClick: () => { goTab('grn'); setGrnStatus('DRAFT'); },
    },
    {
      key: 'approve', icon: ClipboardCheck,
      label: perms.canApprovePr ? 'To approve' : 'Waiting for approval', value: stats?.prSubmitted,
      hint: perms.canApprovePr ? 'Requisitions to approve' : 'Submitted, with the factory admin',
      warn: perms.canApprovePr && (stats?.prSubmitted ?? 0) > 0,
      active: tab === 'pr' && prStatus === 'SUBMITTED',
      onClick: () => { goTab('pr'); setPrStatus('SUBMITTED'); },
    },
    {
      key: 'ready', icon: Wallet, label: 'Ready to pay', value: stats?.prApproved,
      hint: 'Approved requisitions',
      warn: perms.canExecute && (stats?.prApproved ?? 0) > 0,
      active: tab === 'pr' && prStatus === 'APPROVED',
      onClick: () => { goTab('pr'); setPrStatus('APPROVED'); },
    },
    {
      key: 'unpaid', icon: WalletCards, label: 'Unpaid', value: stats?.poUnpaid,
      hint: unpaidValue != null ? `${formatCurrency(unpaidValue)} outstanding` : undefined,
      warn: perms.canMarkPaid && (stats?.poUnpaid ?? 0) > 0,
      active: tab === 'po' && poPay === 'UNPAID',
      onClick: () => { goTab('po'); setPoStatus(PO_STATUS_FILTERS[0].value); setPoPay('UNPAID'); },
    },
    {
      key: 'qc', icon: ShieldCheck, label: 'Awaiting QC', value: stats?.grnPendingQc,
      hint: 'Goods receipts with the QC team',
      warn: false,
      active: tab === 'grn' && grnStatus === 'PENDING_QC',
      onClick: () => { goTab('grn'); setGrnStatus('PENDING_QC'); },
    },
  ];
  // Four tiles per role: approvers/finance see their decisions, requesters (store) their pipeline.
  const isBuyerOrApprover = perms.canApprovePr || perms.canExecute || perms.canMarkPaid;
  const tileKeys = isBuyerOrApprover ? ['approve', 'ready', 'unpaid', 'qc'] : ['drafts', 'approve', 'receipts', 'qc'];
  const tiles = tileKeys.map((k) => allTiles.find((t) => t.key === k)!);

  const common = {
    search: searchInput,
    onSearch: setSearchInput,
    page,
    onPage: setPage,
    selectedId,
    onSelect: setSelectedId,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase"
        description="Raise requisitions, pay suppliers and receive goods."
        secondaryActions={perms.canExport && tab !== 'suppliers' ? (
          <Button variant="secondary" icon={<Download size={16} />} onClick={exportCurrent}>Export</Button>
        ) : undefined}
        primaryAction={primaryAction}
      />

      <InfoBanner inset={false} tone="info" title="How purchasing works" dismissKey="purchase-how-it-works">
        A requisition is approved by the factory admin, then paid once you agree the price with the supplier on a call.
        Goods are received against the payment with the supplier invoice, checked by incoming QC, and then enter stock.
      </InfoBanner>

      <KpiGrid cols={4}>
        {tiles.map((t) => (
          <StatTile
            key={t.key}
            icon={t.icon}
            label={t.label}
            value={t.value ?? '—'}
            hint={t.hint}
            highlight={t.warn ? 'warn' : undefined}
            active={t.active}
            onClick={t.onClick}
          />
        ))}
      </KpiGrid>

      <Section flush>
        <div className="px-3">
          <Tabs
            ariaLabel="Purchase sections"
            className="!mb-0"
            active={tab}
            onChange={(id) => goTab(id as TabId)}
            tabs={[
              { id: 'pr', label: 'Requisitions', count: stats ? prOpenCount : undefined },
              { id: 'po', label: 'Payments', count: stats?.poUnpaid },
              { id: 'grn', label: 'Goods receipts', count: stats ? grnOpenCount : undefined },
              ...(perms.canExecute ? [{ id: 'suppliers', label: 'Suppliers', count: stats?.suppliers }] : []),
              { id: 'history', label: 'History' },
            ]}
          />
        </div>

        {tab === 'pr' && (
          <RequisitionsTab
            {...common}
            perms={perms}
            status={prStatus}
            onStatus={setPrStatus}
            highlightId={highlightId}
            onNewPr={() => setPrFormOpen(true)}
            onCreatePayment={(prId) => openPayment(prId)}
            onEdit={(pr) => { setSelectedId(null); setEditingPr(pr); }}
            run={run}
          />
        )}
        {tab === 'po' && (
          <PaymentsTab
            {...common}
            perms={perms}
            status={poStatus}
            onStatus={setPoStatus}
            pay={poPay}
            onPay={setPoPay}
            highlightId={highlightId}
            onReceive={(poId) => openGrn(poId)}
            onNewPayment={() => openPayment()}
            run={run}
          />
        )}
        {tab === 'grn' && (
          <ReceiptsTab
            {...common}
            perms={perms}
            status={grnStatus}
            onStatus={setGrnStatus}
            highlightId={highlightId}
            onNewGrn={() => openGrn()}
            run={run}
          />
        )}
        {tab === 'suppliers' && perms.canExecute && (
          <SuppliersPanel onNew={() => setSupplierFormOpen(true)} highlightId={highlightId} focusSearch={supplierFocus} />
        )}
        {tab === 'history' && (
          <HistoryTab
            {...common}
            onViewPayment={(po) => {
              goTab('po', { keepSearch: true });
              setPoStatus(PO_STATUS_FILTERS[0].value);
              setPoPay('');
              setSearchInput(po.poNumber);
            }}
          />
        )}
      </Section>

      <PrFormDrawer
        open={prFormOpen || !!editingPr}
        editing={editingPr}
        onClose={() => { setPrFormOpen(false); setEditingPr(null); }}
        onCreated={(pr) => {
          if (tab !== 'pr') goTab('pr');
          setPrStatus(PR_STATUS_FILTERS[0].value);
          flash(pr._id);
        }}
      />
      <PaymentFormDrawer
        open={paymentForm.open}
        initialPrId={paymentForm.prId}
        onClose={() => setPaymentForm({ open: false })}
        onCreated={(po) => {
          if (tab !== 'po') goTab('po');
          setPoStatus(PO_STATUS_FILTERS[0].value);
          setPoPay('');
          flash(po._id);
        }}
      />
      <GrnFormDrawer
        open={grnForm.open}
        initialPoId={grnForm.poId}
        onClose={() => setGrnForm({ open: false })}
        onCreated={(grn) => {
          if (tab !== 'grn') goTab('grn');
          setGrnStatus(GRN_STATUS_FILTERS[0].value);
          flash(grn._id);
        }}
      />
      <SupplierFormDrawer
        open={supplierFormOpen}
        onClose={() => setSupplierFormOpen(false)}
        onSaved={(s) => { setSupplierFocus(s.supplierCode || s.name || null); flash(s._id); }}
      />
    </div>
  );
}
