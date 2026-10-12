import { useMutation } from '@tanstack/react-query';
import { toast, useConfirm, usePrompt } from '../../components/erp';
import { purchaseApi } from '../../services/operations';
import type { GoodsReceipt, PurchaseOrder, PurchaseRequisition } from '../../types/api';
import { filesToImagePayloads } from '../inventory/inventoryUtils';
import { prNumber } from './purchaseUtils';
import { RECEIPT_ACCEPT, useInvalidatePurchase, type ReceiptFile } from './purchaseShared';

export type WorkflowAction =
  | { type: 'submitPr' | 'approvePr' | 'cancelPr'; id: string; number?: string }
  | { type: 'rejectPr' | 'requestPrChanges'; id: string; number?: string; comments: string }
  | { type: 'approvePo' | 'markPaid'; id: string; number?: string }
  | { type: 'cancelPo' | 'closePo'; id: string; number?: string; reason?: string }
  | { type: 'submitGrn' | 'cancelGrn'; id: string; number?: string };

const MESSAGES: Record<WorkflowAction['type'], { title: string; description?: string }> = {
  submitPr: { title: 'sent for approval', description: 'The factory admin will approve or send it back.' },
  approvePr: { title: 'approved', description: 'Create a payment once the price is agreed with the supplier.' },
  rejectPr: { title: 'rejected' },
  requestPrChanges: { title: 'sent back for changes', description: 'It is a draft again for the requester.' },
  cancelPr: { title: 'cancelled' },
  approvePo: { title: 'approved', description: 'Goods can now be received against it.' },
  markPaid: { title: 'marked as paid' },
  cancelPo: { title: 'cancelled', description: 'The requisition is back to Approved.' },
  closePo: { title: 'short-closed', description: 'The unreceived balance is no longer expected.' },
  submitGrn: { title: 'sent to incoming QC', description: 'Stock is updated once Quality passes the goods.' },
  cancelGrn: { title: 'cancelled', description: 'Its quantities are open on the payment again.' },
};

/** One mutation for every purchase status change, with a contextual success toast. */
export function usePurchaseWorkflow() {
  const invalidate = useInvalidatePurchase();
  return useMutation({
    mutationFn: async (a: WorkflowAction): Promise<unknown> => {
      switch (a.type) {
        case 'submitPr': return purchaseApi.submitPR(a.id);
        case 'approvePr': return purchaseApi.approvePR(a.id);
        case 'rejectPr': return purchaseApi.rejectPR(a.id, a.comments);
        case 'requestPrChanges': return purchaseApi.requestPrChanges(a.id, a.comments);
        case 'cancelPr': return purchaseApi.cancelPR(a.id);
        case 'approvePo': return purchaseApi.approvePO(a.id);
        case 'markPaid': return purchaseApi.markPoPaid(a.id);
        case 'cancelPo': return purchaseApi.cancelPO(a.id, a.reason || undefined);
        case 'closePo': return purchaseApi.closePO(a.id, a.reason || undefined);
        case 'submitGrn': return purchaseApi.submitGrnQc(a.id);
        case 'cancelGrn': return purchaseApi.cancelGRN(a.id);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (result, a) => {
      invalidate();
      const msg = MESSAGES[a.type];
      // Multi-level approval: the PR may still be SUBMITTED after one approver acts.
      const stillPending = a.type === 'approvePr' && result && typeof result === 'object'
        && 'status' in result && (result as PurchaseRequisition).status !== 'APPROVED';
      const subject = a.number || 'Done';
      toast.success(
        stillPending ? `${subject}: your approval is recorded` : `${subject} ${msg.title}`,
        { description: stillPending ? 'It now waits for the next approval level.' : msg.description },
      );
    },
  });
}

/** Upload invoice / supporting files onto a payment or goods receipt. */
export function useAttachReceipts() {
  const invalidate = useInvalidatePurchase();
  return useMutation({
    mutationFn: async ({ kind, id, current, files }: { kind: 'po' | 'grn'; id: string; current: ReceiptFile[]; files: File[] }) => {
      const uploaded = await filesToImagePayloads(files);
      const receipts = [...current, ...uploaded].slice(0, 12);
      return kind === 'po' ? purchaseApi.setPoReceipts(id, receipts) : purchaseApi.setGrnReceipts(id, receipts);
    },
    meta: { successMessage: 'Invoice uploaded' },
    onSuccess: () => invalidate(),
  });
}

/** Open the OS file picker from code; resolves [] when the user cancels. */
export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    const done = (files: File[]) => { input.remove(); resolve(files); };
    input.addEventListener('change', () => done([...(input.files || [])]));
    input.addEventListener('cancel', () => done([]));
    document.body.appendChild(input);
    input.click();
  });
}

export function downloadReceipt(item: ReceiptFile) {
  if (!item.kind || !item.docId || item.index == null) return;
  purchaseApi.downloadReceipt(item.kind, item.docId, item.index, item.fileName)
    .catch((e: Error) => toast.error(e.message || 'Download failed'));
}

/**
 * Confirm / prompt flows for the reasoned or irreversible actions.
 * Each returns a function that asks the user, then runs the workflow mutation.
 */
export function usePurchaseDialogs(run: (a: WorkflowAction) => void) {
  const confirm = useConfirm();
  const prompt = usePrompt();
  return {
    rejectPr: async (pr: PurchaseRequisition) => {
      const comments = await prompt({
        title: `Reject ${pr.prNumber}?`,
        message: 'The requester sees your reason. They can revise and resubmit.',
        label: 'Reason',
        placeholder: 'e.g. Stock is already on order',
        minLength: 3,
        tone: 'danger',
        confirmLabel: 'Reject requisition',
      });
      if (comments != null) run({ type: 'rejectPr', id: pr._id, number: pr.prNumber, comments });
    },
    requestChanges: async (pr: PurchaseRequisition) => {
      const comments = await prompt({
        title: `Request changes to ${pr.prNumber}`,
        message: 'It goes back to the requester as a draft.',
        label: 'What should change?',
        placeholder: 'e.g. Reduce thread quantity to 40 cones',
        minLength: 3,
        confirmLabel: 'Send back',
      });
      if (comments != null) run({ type: 'requestPrChanges', id: pr._id, number: pr.prNumber, comments });
    },
    cancelPr: async (pr: PurchaseRequisition) => {
      const ok = await confirm({
        title: `Cancel ${pr.prNumber}?`,
        message: 'The requisition is withdrawn and cannot be submitted again.',
        confirmLabel: 'Cancel requisition',
        cancelLabel: 'Keep it',
        tone: 'danger',
      });
      if (ok) run({ type: 'cancelPr', id: pr._id, number: pr.prNumber });
    },
    cancelPo: async (po: PurchaseOrder) => {
      const reason = await prompt({
        title: `Cancel payment ${po.poNumber}?`,
        message: po.prId
          ? `Requisition ${prNumber(po.prId)} goes back to Approved so a new payment can be made.`
          : 'Nothing can be received against it afterwards.',
        label: 'Reason (optional)',
        required: false,
        tone: 'danger',
        confirmLabel: 'Cancel payment',
      });
      if (reason != null) run({ type: 'cancelPo', id: po._id, number: po.poNumber, reason });
    },
    closePo: async (po: PurchaseOrder) => {
      const reason = await prompt({
        title: `Short-close ${po.poNumber}?`,
        message: 'The unreceived balance will no longer be expected. Receipts already in QC still complete.',
        label: 'Reason (optional)',
        required: false,
        confirmLabel: 'Short-close',
      });
      if (reason != null) run({ type: 'closePo', id: po._id, number: po.poNumber, reason });
    },
    /**
     * The API only marks a payment paid once a supplier invoice is on it (or on one of its GRNs),
     * so without one we first ask for the file, upload it, then confirm.
     */
    markPaid: async (po: PurchaseOrder, hasInvoice: boolean, uploadInvoice?: (files: File[]) => Promise<unknown>) => {
      if (!hasInvoice) {
        const attach = await confirm({
          title: `Attach the invoice for ${po.poNumber}`,
          message: 'A payment is marked paid against the supplier invoice. Upload a photo or PDF of it — it is saved on the payment.',
          confirmLabel: 'Choose invoice file',
          tone: 'primary',
        });
        if (!attach || !uploadInvoice) return;
        const files = await pickFiles(RECEIPT_ACCEPT);
        if (!files.length) return;
        try {
          await uploadInvoice(files);
        } catch {
          return; // the upload mutation already shows the error
        }
      }
      const ok = await confirm({
        title: `Mark ${po.poNumber} as paid?`,
        message: 'Confirm the supplier has been paid against the uploaded invoice. This cannot be undone.',
        confirmLabel: 'Mark paid',
        tone: 'primary',
      });
      if (ok) run({ type: 'markPaid', id: po._id, number: po.poNumber });
    },
    cancelGrn: async (grn: Pick<GoodsReceipt, '_id' | 'grnNumber'>) => {
      const ok = await confirm({
        title: `Cancel ${grn.grnNumber}?`,
        message: 'Its quantities are reopened on the payment. This cannot be undone.',
        confirmLabel: 'Cancel receipt',
        cancelLabel: 'Keep it',
        tone: 'danger',
      });
      if (ok) run({ type: 'cancelGrn', id: grn._id, number: grn.grnNumber });
    },
  };
}
