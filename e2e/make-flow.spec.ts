import { test, expect, type Page, type Locator } from '@playwright/test';
import { api, apiLogin, expectToast, loginAs, type RoleKey } from './helpers';

/**
 * Make-to-ship flow, driven through the UI role by role:
 * planner → production manager → planner → operator (tablet) ↔ QC → warehouse,
 * plus waste, CAPA, machines/lines/shifts, schedules, cancel + rollback.
 *
 * Run against a LOCAL stack (in-memory demo DB):
 *   PLAYWRIGHT_BASE_URL=http://localhost:5323 E2E_API_URL=http://localhost:3323/api/v1 npx playwright test e2e/make-flow.spec.ts --workers=1
 */

const SKU_CODE = 'STY-0001UNI-DSS-REF-NVY-M'; // seeded SKU with an ACTIVE BOM
const QTY = 6;
const TABLET = { width: 1024, height: 768 };

const state: {
  orderNumber?: string;
  orderId?: string;
  batchNumber?: string;
  batchId?: string;
  topUpBatchNumber?: string;
  rejectedInProcess?: number;
} = {};

/* ───────────── helpers ───────────── */

const dialog = (page: Page, name?: string | RegExp) =>
  (name ? page.getByRole('dialog', { name }) : page.getByRole('dialog')).last();

/** Confirm dialogs render as role=alertdialog. */
async function confirmDialog(page: Page, button: string | RegExp) {
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: button }).click();
  await expect(dlg).toBeHidden();
}

async function pickSearchSelect(page: Page, trigger: Locator, text: string) {
  await trigger.click();
  await page.getByRole('combobox', { name: 'Filter options' }).fill(text);
  await page.getByRole('option').filter({ hasText: text }).first().click();
}

async function orderRow(page: Page, orderNumber: string) {
  const row = page.locator('tbody tr').filter({ hasText: orderNumber });
  await expect(row).toBeVisible();
  return row;
}

async function openProductionTab(page: Page, tab: 'Orders' | 'Batches' | 'Batch board' | 'Schedules') {
  await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
}

async function asApi(request: Parameters<typeof apiLogin>[0], role: RoleKey) {
  return api(request, await apiLogin(request, role));
}

/* ───────────── flow ───────────── */

test.describe.serial('Make-to-ship flow', () => {
  test('planner creates an order, runs MRP, reserves material and submits for approval', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'planner');
    await page.goto('/production/orders');
    await expect(page.getByRole('heading', { name: 'Production' })).toBeVisible();
    await openProductionTab(page, 'Orders');

    await page.getByRole('button', { name: 'New production order' }).first().click();
    const drawer = dialog(page, 'New production order');
    await expect(drawer).toBeVisible();
    await pickSearchSelect(page, drawer.getByRole('button', { name: 'SKU', exact: true }), SKU_CODE);
    await drawer.getByLabel('Quantity (pieces)').fill(String(QTY));
    await drawer.getByRole('button', { name: 'Create order' }).click();
    await expectToast(page, 'Production order created');

    // The new order's drawer opens: read its number from the title.
    const orderDrawer = dialog(page, /^PROD-/);
    await expect(orderDrawer).toBeVisible();
    state.orderNumber = (await orderDrawer.getByRole('heading').first().innerText()).trim();
    expect(state.orderNumber).toMatch(/^PROD-/);

    await orderDrawer.getByRole('button', { name: 'Run MRP' }).click();
    await expectToast(page, 'Material requirements calculated');
    await expect(orderDrawer.getByText('Materials planned').first()).toBeVisible();
    // Seed stock covers a small qty: no shortage, so no PR link on the row.
    await expect(orderDrawer.getByText('All materials are available.')).toBeVisible();

    await orderDrawer.getByRole('button', { name: 'Reserve material' }).click();
    await expectToast(page, 'Raw material reserved');

    await orderDrawer.getByRole('button', { name: 'Submit for approval' }).click();
    await expectToast(page, 'Submitted for approval');
    await expect(orderDrawer.getByText('Approval pending').first()).toBeVisible();
    await orderDrawer.getByRole('button', { name: 'Close' }).last().click();

    await orderRow(page, state.orderNumber!);
    // NB: the demo seed delegates production.approve from the production manager to the planner,
    // so the planner holds approve rights too — but whoever raised the order cannot approve it (four-eyes), so the manager approves below.

    const prod = await asApi(request, 'planner');
    const orders = await prod.get('/production-orders', { search: state.orderNumber! });
    state.orderId = orders[0]._id;
    expect(orders[0].status).toBe('APPROVAL_PENDING');

    problems.assertNone();
    await context.close();
  });

  test('production manager approves the order from the Approvals inbox', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'productionManager');
    await page.goto('/approvals');
    const item = page.getByRole('listitem').filter({ hasText: state.orderNumber! });
    await expect(item).toBeVisible({ timeout: 15_000 });
    await item.getByRole('button', { name: /^Approve/ }).click();
    const prompt = dialog(page, new RegExp(`Approve ${state.orderNumber}`));
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: 'Approve' }).click();
    await expectToast(page, `${state.orderNumber} approved`);
    await expect(item).toBeHidden();

    // The production page reflects it.
    await page.goto('/production/orders');
    await openProductionTab(page, 'Orders');
    const row = await orderRow(page, state.orderNumber!);
    await expect(row.getByText('Approved')).toBeVisible();
    problems.assertNone();
    await context.close();
  });

  test('planner creates a batch (qty defaults to remaining) and assigns machine + worker', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'planner');
    await page.goto('/production/orders');
    await openProductionTab(page, 'Orders');
    const row = await orderRow(page, state.orderNumber!);
    await row.getByRole('button', { name: `New batch (${QTY})` }).click();
    const modal = dialog(page, `New batch for ${state.orderNumber}`);
    await expect(modal.getByLabel('Batch quantity (pieces)')).toHaveValue(String(QTY));
    await modal.getByRole('button', { name: 'Create batch' }).click();
    await expectToast(page, 'Batch created');
    await expect(row.getByText('In progress')).toBeVisible();
    await expect(row.getByRole('button', { name: /New batch/ })).toHaveCount(0);

    // Batches tab → assign machine/worker on the new batch.
    await openProductionTab(page, 'Batches');
    const batchRow = page.locator('tbody tr').filter({ hasText: state.orderNumber! }).first();
    await expect(batchRow).toBeVisible();
    state.batchNumber = (await batchRow.locator('td').first().innerText()).trim();
    await batchRow.getByRole('button', { name: `Actions for ${state.batchNumber}` }).click();
    await page.getByRole('menuitem', { name: 'Assign machine / worker' }).click();
    const assign = dialog(page, `Assign ${state.batchNumber}`);
    await assign.getByLabel('Machine').selectOption({ index: 1 });
    const workerSelect = assign.getByLabel('Worker');
    const operatorOption = workerSelect.locator('option', { hasText: 'Machine Operator' }).first();
    await expect(operatorOption).toBeAttached();
    await workerSelect.selectOption((await operatorOption.getAttribute('value'))!);
    await assign.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Resources assigned');

    await batchRow.click();
    const bd = dialog(page, state.batchNumber);
    await expect(bd.getByText('Machine Operator')).toBeVisible();
    await expect(bd.getByText('Not assigned')).toHaveCount(0);
    await bd.getByRole('button', { name: 'Close' }).last().click();

    const prod = await asApi(request, 'planner');
    const batches = await prod.get('/batches', { productionOrderId: state.orderId! });
    state.batchId = batches[0]._id;
    expect(batches[0].plannedQuantity).toBe(QTY);
    problems.assertNone();
    await context.close();
  });

  test('operator runs the batch on the tablet board; QC does in-process QC at gated stages', async ({ browser, request }) => {
    test.setTimeout(600_000);
    const op = await loginAs(browser, request, 'operator');
    await op.page.setViewportSize(TABLET);
    const qc = await loginAs(browser, request, 'qc');
    const planner = await asApi(request, 'planner');

    await op.page.goto('/production/orders');
    await openProductionTab(op.page, 'Batch board');
    const card = op.page.locator('li').filter({ hasText: state.batchNumber! });
    await expect(card).toBeVisible();

    // Tablet: primary action and overflow trigger are finger-sized.
    const start = card.getByRole('button', { name: 'Start batch' });
    const box = await start.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
    const menuBox = await card.getByRole('button', { name: `Actions for ${state.batchNumber}` }).boundingBox();
    expect(menuBox!.height).toBeGreaterThanOrEqual(36);
    // Board scrolls inside its own container — the page itself must not scroll sideways.
    expect(await op.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

    await start.click();
    await expectToast(op.page, 'Batch started');

    // QC was notified that in-process QC is due.
    const qcApi = await asApi(request, 'qc');
    const qcNotes = await qcApi.get('/notifications', { limit: 20 });
    expect(qcNotes.some((n: { message?: string }) => n.message?.includes(state.batchNumber!) && /in-process/i.test(n.message))).toBeTruthy();

    await qc.page.goto('/quality/inspections?tab=inprocess');
    let partialDone = false;
    let firstGate = true;
    for (let guard = 0; guard < 15; guard++) {
      const b = await planner.get(`/batches/${state.batchId}`);
      if (b.status === 'COMPLETED') break;
      const stage: string = b.currentStage;
      const label = stage.charAt(0) + stage.slice(1).toLowerCase();
      const gated = ['CUTTING', 'STITCHING', 'FINISHING', 'PACKING'].includes(stage) && !b.stageQcPassed?.[stage];

      if (gated) {
        // Operator can't complete yet: the card shows a disabled wait state (no dead-end link to Quality).
        const waiting = card.getByRole('button', { name: `Waiting for ${label} QC` });
        await expect(waiting).toBeVisible({ timeout: 20_000 });
        await expect(waiting).toBeDisabled();

        // QC inspects from the Quality page.
        await qc.page.getByRole('tab', { name: /^In-process/ }).click();
        const row = qc.page.locator('tbody tr').filter({ hasText: state.batchNumber! });
        await expect(row).toBeVisible({ timeout: 20_000 });
        // QC's queue follows the floor on its own (polling) — no manual refresh.
        await expect(row).toContainText(label, { timeout: 25_000 });
        await row.getByRole('button', { name: /^(Inspect|Complete)$/ }).click();
        const drawer = dialog(qc.page, /^Complete QC-/);
        await expect(drawer).toBeVisible();
        const good = b.plannedQuantity - (b.rejectedQuantity || 0);
        await expect(drawer.getByLabel('Passed')).toHaveValue(String(good));
        if (!partialDone) {
          // One partial: reject 1 piece — the batch's good qty drops.
          await drawer.getByLabel('Passed').fill(String(good - 1));
          await expect(drawer.getByLabel('Failed')).toHaveValue('1');
          partialDone = true;
          state.rejectedInProcess = 1;
        }
        await drawer.getByRole('button', { name: 'Complete inspection' }).click();
        await confirmDialog(qc.page, 'Complete inspection');
        await expectToast(qc.page, /Inspection QC-.* completed/);

        if (state.rejectedInProcess && guard < 2) {
          const after = await planner.get(`/batches/${state.batchId}`);
          expect(after.rejectedQuantity).toBe(1);
          await expect(row.locator('td').nth(3)).toHaveText(String(QTY - 1));
        }

        // Operator's board picks the pass up on its own (no manual refresh) the first time.
        if (firstGate) {
          await expect(card.getByRole('button', { name: `Complete ${label}` })).toBeVisible({ timeout: 25_000 });
          await expect(card).toContainText(`${QTY - 1} pcs`);
          await expect(card).toContainText('1 rejected');
          firstGate = false;
        } else {
          await op.page.getByRole('button', { name: 'Refresh' }).click();
        }
      }

      const complete = card.getByRole('button', { name: `Complete ${label}` });
      await expect(complete).toBeVisible({ timeout: 20_000 });
      await complete.click();
      const modal = dialog(op.page, `Complete ${label}`);
      await expect(modal).toBeVisible();
      if (stage === 'PRINTING') {
        // Operator records fabric scrap from the stage (materials come from what was issued to the batch).
        await modal.getByLabel('Record material scrap from this stage').check();
        const mat = modal.getByLabel('Scrapped material');
        await expect(mat.locator('option', { hasText: 'FAB-COT-001' })).toBeAttached();
        await mat.selectOption({ label: 'FAB-COT-001 — Cotton Fabric White' });
        await modal.getByLabel(/^Qty/).fill('0.5');
      }
      const submit = modal.getByRole('button', { name: /^(Complete & move to|Finish line)/ });
      // Layout height, not boundingBox(): the dialog's opening zoom scales the box to ~98%.
      expect(await submit.evaluate((el) => (el as HTMLElement).offsetHeight)).toBeGreaterThanOrEqual(44);
      await submit.click();
      await expectToast(op.page, `${label} completed`);
      await expect(modal).toBeHidden();
    }

    const done = await planner.get(`/batches/${state.batchId}`);
    expect(done.status).toBe('COMPLETED');
    expect(done.producedQuantity).toBe(QTY - 1);
    // Operator sees it waiting for final QC, not a link into Quality.
    await expect(card.getByRole('button', { name: 'Waiting for final QC' })).toBeDisabled();

    op.problems.assertNone();
    qc.problems.assertNone();
    await op.context.close();
    await qc.context.close();
  });

  test('QC completes final QC (passed + failed = batch qty) and FG lands in inventory', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'qc');
    const admin = await asApi(request, 'admin');
    const fgBefore = await fgOnHand(admin);

    await page.goto('/quality/inspections');
    await page.getByRole('tab', { name: /^Final/ }).click();
    const row = page.locator('tbody tr').filter({ hasText: state.batchNumber! });
    await expect(row).toBeVisible({ timeout: 20_000 });
    const lot = QTY - (state.rejectedInProcess ?? 0);
    await expect(row.locator('td').nth(1)).toHaveText(String(lot));
    await row.getByRole('button', { name: 'Final QC' }).click();

    const drawer = dialog(page, /^Complete QC-/);
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel('Passed')).toHaveValue(String(lot));
    // Mismatched counts are blocked client-side.
    await drawer.getByLabel('Failed').fill('3');
    await drawer.getByRole('button', { name: 'Complete inspection' }).click();
    await expect(drawer.getByText(`passed + failed must equal ${lot}`).first()).toBeVisible();
    // 1 fails final QC → passed = lot − 1.
    await drawer.getByLabel('Passed').fill(String(lot - 1));
    await expect(drawer.getByLabel('Failed')).toHaveValue('1');
    await drawer.getByRole('button', { name: 'Complete inspection' }).click();
    await confirmDialog(page, 'Complete inspection');
    await expectToast(page, /Inspection QC-.* completed/);
    await expect(row).toBeHidden();

    expect(await fgOnHand(admin)).toBe(fgBefore + lot - 1);
    const order = (await admin.get('/production-orders', { search: state.orderNumber! }))[0];
    expect(order.passedQuantity).toBe(lot - 1);
    expect(order.status).toBe('IN_PROGRESS'); // 4 of 6 passed — not done yet
    expect(order.remainingToBatch).toBe(QTY - (lot - 1));

    // Warehouse was told FG arrived.
    const wh = await asApi(request, 'warehouse');
    const notes = await wh.get('/notifications', { limit: 20 });
    expect(notes.some((n: { message?: string }) => n.message?.includes(state.batchNumber!) && /final QC/i.test(n.message))).toBeTruthy();

    problems.assertNone();
    await context.close();
  });

  test('planner sees progress, tops up the rejects with a new batch, and the order completes after its final QC', async ({ browser, request }) => {
    test.setTimeout(300_000);
    const { page, problems, context } = await loginAs(browser, request, 'planner');
    await page.goto('/production/orders');
    await openProductionTab(page, 'Orders');
    const passed = QTY - (state.rejectedInProcess ?? 0) - 1;
    const remaining = QTY - passed;
    const row = await orderRow(page, state.orderNumber!);
    await expect(row).toContainText(`${passed} / ${QTY}`);

    await row.getByRole('button', { name: `New batch (${remaining})` }).click();
    const modal = dialog(page, `New batch for ${state.orderNumber}`);
    await expect(modal.getByLabel('Batch quantity (pieces)')).toHaveValue(String(remaining));
    await modal.getByLabel('Batch quantity (pieces)').fill(String(remaining + 1));
    await modal.getByRole('button', { name: 'Create batch' }).click();
    await expect(modal.getByText(`Only ${remaining} pieces are left`)).toBeVisible();
    await modal.getByLabel('Batch quantity (pieces)').fill(String(remaining));
    await modal.getByRole('button', { name: 'Create batch' }).click();
    await expectToast(page, 'Batch created');

    // The top-up batch repeats the line flow already driven through the UI above — run it via the API.
    const pl = await asApi(request, 'planner');
    const qcApi = await asApi(request, 'qc');
    const batches = await pl.get('/batches', { productionOrderId: state.orderId! });
    const topUp = batches.find((b: { _id: string }) => b._id !== state.batchId);
    state.topUpBatchNumber = topUp.batchNumber;
    await pl.post(`/batches/${topUp._id}/start`);
    for (let i = 0; i < 15; i++) {
      const b = await pl.get(`/batches/${topUp._id}`);
      if (b.status === 'COMPLETED') break;
      if (['CUTTING', 'STITCHING', 'FINISHING', 'PACKING'].includes(b.currentStage) && !b.stageQcPassed?.[b.currentStage]) {
        const insp = await qcApi.post(`/batches/${topUp._id}/in-process-qc`);
        await qcApi.post(`/quality-inspections/${insp._id}/complete`, { passedQuantity: remaining, failedQuantity: 0, disposition: 'PASS', result: 'PASS' });
      }
      await pl.post(`/batches/${topUp._id}/complete-stage`, {});
    }
    // Final QC for the top-up via the QC UI.
    const qc = await loginAs(browser, request, 'qc');
    await qc.page.goto('/quality/inspections');
    await qc.page.getByRole('tab', { name: /^Final/ }).click();
    const fRow = qc.page.locator('tbody tr').filter({ hasText: state.topUpBatchNumber! });
    await fRow.getByRole('button', { name: 'Final QC' }).click();
    const drawer = dialog(qc.page, /^Complete QC-/);
    await expect(drawer.getByLabel('Passed')).toHaveValue(String(remaining));
    await drawer.getByRole('button', { name: 'Complete inspection' }).click();
    await confirmDialog(qc.page, 'Complete inspection');
    await expectToast(qc.page, /Inspection QC-.* completed/);
    qc.problems.assertNone();
    await qc.context.close();

    // Planner's list catches up on its own and shows the order completed.
    await expect(row).toContainText('Completed', { timeout: 25_000 });
    await expect(row).toContainText(`${QTY} / ${QTY}`);
    await expect(row.getByRole('button', { name: /New batch/ })).toHaveCount(0);
    const notes = await pl.get('/notifications', { limit: 20 });
    expect(notes.some((n: { title?: string; message?: string }) => n.title === 'Production order completed' && n.message?.includes(state.orderNumber!))).toBeTruthy();
    problems.assertNone();
    await context.close();
  });

  test('warehouse puts FG away into an FG bin, stages it, marks it ready and dispatches', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'warehouse');
    const admin = await asApi(request, 'admin');
    const onHand = await fgOnHand(admin);
    expect(onHand).toBeGreaterThanOrEqual(QTY);

    await page.goto('/warehouse/operations/put-away');
    await page.getByRole('radio', { name: 'Finished goods' }).click();
    await pickSearchSelect(page, page.getByRole('button', { name: 'SKU', exact: true }), SKU_CODE);
    await expect(page.getByText('Not in a bin')).toBeVisible();
    const binRow = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: /^Put away/ }) }).first();
    const binName = (await binRow.locator('td').first().innerText()).trim();
    await binRow.getByRole('button', { name: `Put away ${onHand}` }).click();
    // Put-away is one click now (routine, reversible) — no confirmation step.
    await expectToast(page, /Put away|staged/i);
    await expect(page.getByText(binName).first()).toBeVisible();

    await page.goto('/warehouse/operations/dispatch');
    await pickSearchSelect(page, page.getByRole('button', { name: 'SKU', exact: true }), SKU_CODE);
    await expect(page.getByLabel('Bin')).not.toHaveValue('');
    await page.getByRole('button', { name: 'Mark ready to ship' }).click();
    await confirmDialog(page, 'Mark ready');
    await expectToast(page, 'Marked ready to ship');
    const ready = page.locator('tbody tr').filter({ hasText: SKU_CODE }).first();
    await expect(ready).toBeVisible();
    await ready.getByRole('button', { name: 'Dispatch' }).click();
    await confirmDialog(page, 'Dispatch');
    await expectToast(page, 'Dispatched');
    expect(await fgOnHand(admin)).toBe(0);
    problems.assertNone();
    await context.close();
  });
});

async function fgOnHand(client: ReturnType<typeof api>): Promise<number> {
  const rows = await client.get('/inventory/balances', { inventoryType: 'FINISHED_GOODS', limit: 100 });
  return rows
    .filter((r: { skuId?: { skuCode?: string } }) => r.skuId?.skuCode === SKU_CODE)
    .reduce((s: number, r: { onHand?: number }) => s + (r.onHand || 0), 0);
}
