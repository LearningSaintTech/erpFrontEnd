import { test, expect, type APIRequestContext, type Download, type Page, type Locator } from '@playwright/test';
import { API_URL, api, apiLogin, expectToast, loginAs, uniq, type RoleKey, type Session } from './helpers';

/**
 * Operations extras, driven through the UI as real roles:
 *   1. stage rollback on a running batch
 *   2. cycle count with posted adjustments
 *   3. RM bin-to-bin transfer
 *   4. reports / dashboard figures vs API truth + CSV export correctness
 *   5. real-time chat between isolated browser contexts (socket.io)
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:5332 E2E_API_URL=http://localhost:3332/api/v1 npx playwright test e2e/operations-extra.spec.ts --workers=1
 */

const SKU_CODE = 'STY-0001UNI-DSS-REF-NVY-M'; // seeded SKU with an ACTIVE BOM
const TABLET = { width: 1024, height: 768 };
const GATED = ['CUTTING', 'STITCHING', 'FINISHING', 'PACKING'];
const NUM = new Intl.NumberFormat('en-US');

/* ───────────── helpers ───────────── */

const dialog = (page: Page, name?: string | RegExp) =>
  (name ? page.getByRole('dialog', { name }) : page.getByRole('dialog')).last();

async function confirmDialog(page: Page, button: string | RegExp) {
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: button }).click();
  await expect(dlg).toBeHidden();
}

async function pickSearchSelect(page: Page, trigger: Locator, text: string) {
  await trigger.click();
  // Short lists render without a filter box.
  const filter = page.getByRole('combobox', { name: 'Filter options' });
  if (await filter.isVisible({ timeout: 1500 }).catch(() => false)) await filter.fill(text);
  await page.getByRole('option').filter({ hasText: text }).first().click();
}

async function asApi(request: APIRequestContext, role: RoleKey) {
  return api(request, await apiLogin(request, role));
}

/** GET a paged list and keep the meta (helpers.api only returns `data`). */
async function apiList(request: APIRequestContext, s: Session, path: string, params: Record<string, string | number | boolean> = {}) {
  const res = await request.get(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${s.accessToken}`, 'X-Factory-Id': s.factoryId },
    params,
  });
  const body = await res.json();
  expect(body.success, `${path}: ${body?.error?.message}`).toBeTruthy();
  return { data: body.data as Record<string, unknown>[], total: (body.meta?.total ?? body.data.length) as number };
}

/** POST expected to fail: returns the API error message. */
async function apiPostError(request: APIRequestContext, s: Session, path: string, data: unknown) {
  const res = await request.post(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${s.accessToken}`, 'X-Factory-Id': s.factoryId },
    data,
  });
  const body = await res.json();
  expect(body.success, `${path} should have been refused`).toBeFalsy();
  return String(body?.error?.message || body?.message || '');
}

const stageLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type Bal = { materialId?: { materialCode?: string } | string; storageBinId?: { _id?: string; binCode?: string } | string | null; onHand?: number; reserved?: number };
async function balancesOf(client: ReturnType<typeof api>, code: string): Promise<Bal[]> {
  const rows: Bal[] = await client.get('/inventory/balances', { search: code, limit: 100, includeEmpty: true });
  return rows.filter((b) => typeof b.materialId === 'object' && b.materialId?.materialCode === code);
}
const binCodeOf = (b: Bal) => (b.storageBinId && typeof b.storageBinId === 'object' ? b.storageBinId.binCode : null);
const totalOnHand = (rows: Bal[]) => round3(rows.reduce((s, b) => s + (b.onHand || 0), 0));

/* ───── CSV ───── */

function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

async function downloadCsvFrom(page: Page, click: () => Promise<void>) {
  // The previous export's success toast sits on top of the header's Export button (UX gap) — let it go first.
  // (The pointer is still parked over it after the last click, which pauses its auto-dismiss — close it.)
  const toasts = page.locator('.erp-toast');
  while (await toasts.count()) await toasts.first().locator('button').last().click();
  await expect(toasts).toHaveCount(0);
  const [dl] = await Promise.all([page.waitForEvent('download'), click()]);
  return readCsv(dl);
}

async function readCsv(dl: Download) {
  const path = await dl.path();
  const fs = await import('node:fs');
  const text = fs.readFileSync(path!, 'utf8');
  const [headers, ...rows] = parseCsv(text);
  return { filename: dl.suggestedFilename(), text, headers, rows, col: (r: string[], h: string) => r[headers.indexOf(h)] };
}

/** Nothing in an export may be a JS artefact or a raw Mongo id. */
function assertCleanCsv(csv: { text: string; headers: string[] }, label: string) {
  expect(csv.text, `${label}: [object Object]`).not.toContain('[object Object]');
  expect(csv.text, `${label}: undefined`).not.toMatch(/(^|,)undefined(,|\r?$)/m);
  expect(csv.text, `${label}: NaN`).not.toMatch(/(^|,)NaN(,|\r?$)/m);
  expect(csv.text, `${label}: raw ObjectId`).not.toMatch(/\b[a-f0-9]{24}\b/);
  for (const h of csv.headers) {
    // Human-readable headers: words with spaces, not camelCase / snake_case field names.
    expect(h, `${label}: header "${h}"`).not.toMatch(/^[a-z]+[A-Z]\w*$|_/);
    expect(h.trim().length).toBeGreaterThan(0);
  }
}

const digits = (s: string) => Number((s.match(/-?[\d,]+(\.\d+)?/)?.[0] || '').replace(/,/g, ''));

/** KPI tile value (and hint) by its label. */
function tile(page: Page, label: string) {
  const t = page.locator('.erp-stat-tile').filter({ has: page.locator('.erp-kpi-label', { hasText: new RegExp(`^${label}$`) }) }).first();
  return { root: t, value: t.locator('.erp-kpi-value') };
}
/** Currency tile → whole rupees: exact hint when the tile shows a compact (₹1.2L) value. */
async function tileRupees(page: Page, label: string) {
  const t = tile(page, label);
  const text = await t.root.innerText();
  const hint = text.split('\n').find((l) => /₹/.test(l) && !/[LKCr]\b|lakh|crore|T$/i.test(l.trim()) && /\d{2},\d{3}/.test(l));
  return digits(hint ?? (await t.value.innerText()));
}

/* ───────────── 1. Stage rollback ───────────── */

const rb: { orderNumber?: string; orderId?: string; batchNumber?: string; batchId?: string; stage1?: string; stage2?: string } = {};
const RB_QTY = 4;

test.describe.serial('Stage rollback', () => {
  test('planner creates + plans an order, production manager approves, planner batches it', async ({ browser, request }) => {
    const pl = await loginAs(browser, request, 'planner');
    const page = pl.page;
    await page.goto('/production/orders');
    await page.getByRole('tab', { name: /^Orders/ }).click();
    await page.getByRole('button', { name: 'New production order' }).first().click();
    const drawer = dialog(page, 'New production order');
    await pickSearchSelect(page, drawer.getByRole('button', { name: 'SKU', exact: true }), SKU_CODE);
    await drawer.getByLabel('Quantity (pieces)').fill(String(RB_QTY));
    await drawer.getByRole('button', { name: 'Create order' }).click();
    await expectToast(page, 'Production order created');
    const od = dialog(page, /^PROD-/);
    rb.orderNumber = (await od.getByRole('heading').first().innerText()).trim();
    await od.getByRole('button', { name: 'Run MRP' }).click();
    await expectToast(page, 'Material requirements calculated');
    await od.getByRole('button', { name: 'Reserve material' }).click();
    await expectToast(page, 'Raw material reserved');
    await od.getByRole('button', { name: 'Submit for approval' }).click();
    await expectToast(page, 'Submitted for approval');
    await od.getByRole('button', { name: 'Close' }).last().click();
    pl.problems.assertNone();

    const pm = await loginAs(browser, request, 'productionManager');
    await pm.page.goto('/approvals');
    const item = pm.page.getByRole('listitem').filter({ hasText: rb.orderNumber });
    await expect(item).toBeVisible({ timeout: 15_000 });
    await item.getByRole('button', { name: /^Approve/ }).click();
    await dialog(pm.page, new RegExp(`Approve ${rb.orderNumber}`)).getByRole('button', { name: 'Approve' }).click();
    await expectToast(pm.page, `${rb.orderNumber} approved`);
    pm.problems.assertNone();
    await pm.context.close();

    await page.reload();
    await page.getByRole('tab', { name: /^Orders/ }).click();
    const row = page.locator('tbody tr').filter({ hasText: rb.orderNumber });
    await row.getByRole('button', { name: `New batch (${RB_QTY})` }).click();
    await dialog(page, `New batch for ${rb.orderNumber}`).getByRole('button', { name: 'Create batch' }).click();
    await expectToast(page, 'Batch created');

    const planner = await asApi(request, 'planner');
    rb.orderId = (await planner.get('/production-orders', { search: rb.orderNumber }))[0]._id;
    const [batch] = await planner.get('/batches', { productionOrderId: rb.orderId! });
    rb.batchId = batch._id;
    rb.batchNumber = batch.batchNumber;
    pl.problems.assertNone();
    await pl.context.close();
  });

  test('operator completes the first stage (QC passes it), rolls back one stage, then advances again', async ({ browser, request }) => {
    test.setTimeout(300_000);
    const planner = await asApi(request, 'planner');
    const qcApi = await asApi(request, 'qc');
    const op = await loginAs(browser, request, 'operator');
    await op.page.setViewportSize(TABLET);
    await op.page.goto('/production/orders');
    await op.page.getByRole('tab', { name: /^Batch board/ }).click();
    const card = op.page.locator('li').filter({ hasText: rb.batchNumber! });
    await card.getByRole('button', { name: 'Start batch' }).click();
    await expectToast(op.page, 'Batch started');

    let b = await planner.get(`/batches/${rb.batchId}`);
    const stages: string[] = b.stages;
    rb.stage1 = b.currentStage;
    expect(rb.stage1).toBe(stages[0]);
    rb.stage2 = stages[1];
    const l1 = stageLabel(rb.stage1!);
    const l2 = stageLabel(rb.stage2!);
    const gated1 = GATED.includes(rb.stage1!);

    // No rollback from the first stage.
    await card.getByRole('button', { name: `Actions for ${rb.batchNumber}` }).click();
    await expect(op.page.getByRole('menuitem', { name: 'Roll back one stage' })).toHaveCount(0);
    await op.page.keyboard.press('Escape');

    const passQc = async () => {
      const cur = await planner.get(`/batches/${rb.batchId}`);
      const good = cur.plannedQuantity - (cur.rejectedQuantity || 0);
      const insp = await qcApi.post(`/batches/${rb.batchId}/in-process-qc`);
      await qcApi.post(`/quality-inspections/${insp._id}/complete`, { passedQuantity: good, failedQuantity: 0, disposition: 'PASS', result: 'PASS' });
    };

    if (gated1) {
      await expect(card.getByRole('button', { name: `Waiting for ${l1} QC` })).toBeDisabled({ timeout: 20_000 });
      // QC inspects through the Quality UI the first time.
      const qc = await loginAs(browser, request, 'qc');
      await qc.page.goto('/quality/inspections?tab=inprocess');
      await qc.page.getByRole('tab', { name: /^In-process/ }).click();
      const row = qc.page.locator('tbody tr').filter({ hasText: rb.batchNumber! });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.getByRole('button', { name: /^(Inspect|Complete)$/ }).click();
      const d = dialog(qc.page, /^Complete QC-/);
      await expect(d.getByLabel('Passed')).toHaveValue(String(RB_QTY));
      await d.getByRole('button', { name: 'Complete inspection' }).click();
      await confirmDialog(qc.page, 'Complete inspection');
      await expectToast(qc.page, /Inspection QC-.* completed/);
      qc.problems.assertNone();
      await qc.context.close();
    }

    const completeStage = async (label: string) => {
      const btn = card.getByRole('button', { name: `Complete ${label}` });
      await expect(btn).toBeVisible({ timeout: 25_000 });
      await btn.click();
      const modal = dialog(op.page, `Complete ${label}`);
      await modal.getByRole('button', { name: /^(Complete & move to|Finish line)/ }).click();
      await expectToast(op.page, `${label} completed`);
      await expect(modal).toBeHidden();
    };
    await completeStage(l1);

    b = await planner.get(`/batches/${rb.batchId}`);
    expect(b.currentStage).toBe(rb.stage2);
    const before = { batch: b, order: (await planner.get('/production-orders', { search: rb.orderNumber! }))[0] };

    // Roll back from the ⋯ menu, with a confirmation.
    await card.getByRole('button', { name: `Actions for ${rb.batchNumber}` }).click();
    await op.page.getByRole('menuitem', { name: 'Roll back one stage' }).click();
    const confirm = op.page.getByRole('alertdialog');
    await expect(confirm).toContainText(`Roll back ${rb.batchNumber}?`);
    await expect(confirm).toContainText(`from ${l2}`);
    await confirmDialog(op.page, 'Roll back');
    await expectToast(op.page, 'Batch moved back one stage');

    const after = await planner.get(`/batches/${rb.batchId}`);
    expect(after.currentStage).toBe(rb.stage1);
    expect(after.status).toBe('REWORK');
    if (gated1) expect(after.stageQcPassed?.[rb.stage1!]).toBeFalsy();
    // Quantities are untouched by a rollback.
    for (const k of ['plannedQuantity', 'producedQuantity', 'rejectedQuantity', 'passedQuantity'] as const) {
      expect(after[k] ?? 0, `batch.${k}`).toBe(before.batch[k] ?? 0);
    }
    const orderAfter = (await planner.get('/production-orders', { search: rb.orderNumber! }))[0];
    for (const k of ['plannedQuantity', 'producedQuantity', 'passedQuantity', 'remainingToBatch'] as const) {
      expect(orderAfter[k] ?? 0, `order.${k}`).toBe(before.order[k] ?? 0);
    }
    // The stage history keeps both visits to stage 2 closed and reopens stage 1.
    const hist: { stage: string; completedAt?: string | null }[] = after.stageHistory || [];
    expect(hist.filter((h) => h.stage === rb.stage1).length).toBe(2);
    expect(hist.filter((h) => !h.completedAt).map((h) => h.stage)).toEqual([rb.stage1]);

    // The board follows: the rolled-back stage needs QC again before it can be completed.
    await op.page.getByRole('button', { name: 'Refresh' }).click();
    if (gated1) {
      await expect(card.getByRole('button', { name: `Waiting for ${l1} QC` })).toBeDisabled({ timeout: 20_000 });
      await expect(card.getByRole('button', { name: `Complete ${l1}` })).toHaveCount(0);
      await passQc();
      await op.page.getByRole('button', { name: 'Refresh' }).click();
    }
    await completeStage(l1);
    const again = await planner.get(`/batches/${rb.batchId}`);
    expect(again.currentStage).toBe(rb.stage2);
    expect(again.plannedQuantity).toBe(RB_QTY);
    expect(again.rejectedQuantity || 0).toBe(before.batch.rejectedQuantity || 0);

    op.problems.assertNone();
    await op.context.close();
  });
});

/* ───────────── 3. Bin transfer (before the count so the count sees the moved stock) ───────────── */

const TR_MAT = 'FAB-COT-001';

test.describe.serial('Bin transfer', () => {
  test('warehouse moves part of a material between bins; over-transfer is blocked', async ({ browser, request }) => {
    const wh = await loginAs(browser, request, 'warehouse');
    const whApi = api(request, wh.session);
    const page = wh.page;

    const rows = await balancesOf(whApi, TR_MAT);
    const totalBefore = totalOnHand(rows);
    const src = rows.filter((r) => binCodeOf(r) && (r.onHand || 0) - (r.reserved || 0) > 20)[0];
    expect(src, 'a bin with free stock').toBeTruthy();
    const srcCode = binCodeOf(src)!;
    const srcAvail = round3((src.onHand || 0) - (src.reserved || 0));
    const targetCode = ['BIN-RM-03', 'BIN-RM-04', 'BIN-RM-05', 'BIN-RM-02'].find((c) => c !== srcCode)!;
    const targetBefore = rows.find((r) => binCodeOf(r) === targetCode)?.onHand || 0;

    await page.goto('/warehouse/operations/transfer');
    await expect(page.getByRole('heading', { name: 'Bin transfer' })).toBeVisible();
    await pickSearchSelect(page, page.getByRole('button', { name: 'Material', exact: true }), TR_MAT);
    const from = page.getByLabel('From');
    const srcOpt = from.locator('option', { hasText: srcCode });
    await expect(srcOpt).toBeAttached();
    await from.selectOption((await srcOpt.getAttribute('value'))!);
    const to = page.getByLabel('To bin');
    await to.selectOption((await to.locator('option', { hasText: targetCode }).getAttribute('value'))!);

    // More than available: blocked client-side with a clear message.
    const qty = page.getByLabel('Quantity');
    await qty.fill(String(Math.ceil(srcAvail) + 5));
    const err = page.getByText(/Only [\d.,]+ available at the source\./);
    await expect(err).toBeVisible();
    expect(digits(await err.innerText())).toBeCloseTo(srcAvail, 3);
    const transferBtn = page.getByRole('button', { name: 'Transfer', exact: true });
    await expect(transferBtn).toBeDisabled();
    // …and server-side, with a message that says how much can move.
    const msg = await apiPostError(request, wh.session, '/warehouse-operations/transfer', {
      materialId: typeof src.materialId === 'object' ? (src.materialId as { _id?: string })._id : src.materialId,
      fromBinId: typeof src.storageBinId === 'object' ? src.storageBinId?._id : src.storageBinId,
      toBinId: await to.inputValue(),
      quantity: srcAvail + 5,
    });
    expect(msg).toMatch(/Only [\d.]+ .*can be moved/);

    await qty.fill('12.5');
    await expect(err).toBeHidden();
    await transferBtn.click();
    const conf = page.getByRole('alertdialog');
    await expect(conf).toContainText(`Move 12.5 to`);
    await expect(conf).toContainText(srcCode);
    await expect(conf).toContainText(targetCode);
    await confirmDialog(page, 'Transfer');
    await expectToast(page, 'Transferred 12.5 units between locations');

    const after = await balancesOf(whApi, TR_MAT);
    expect(round3(after.find((r) => binCodeOf(r) === srcCode)!.onHand || 0)).toBe(round3((src.onHand || 0) - 12.5));
    expect(round3(after.find((r) => binCodeOf(r) === targetCode)!.onHand || 0)).toBe(round3(targetBefore + 12.5));
    expect(totalOnHand(after)).toBe(totalBefore);

    // Movement logged with source → target.
    await page.goto('/inventory?tab=movements');
    await page.getByLabel('Movement type').selectOption('TRANSFER');
    const mv = page.locator('tbody tr').filter({ hasText: TR_MAT }).filter({ hasText: `${srcCode} → ${targetCode}` }).first();
    await expect(mv).toBeVisible();
    await expect(mv).toContainText('12.5');
    await expect(mv).toContainText(`Bin transfer ${targetCode}`);

    wh.problems.assertNone();
    await wh.context.close();
  });
});

/* ───────────── 2. Cycle count ───────────── */

test.describe.serial('Cycle count', () => {
  test('warehouse counts, posts one over + one short; balances move by the variance; no double completion', async ({ browser, request }) => {
    const wh = await loginAs(browser, request, 'warehouse');
    const whApi = api(request, wh.session);
    const page = wh.page;
    const OVER = 'FAB-LIN-001';
    const SHORT = 'FAB-COT-002';
    const CONTROL = 'FAB-COT-001';
    const before = {
      over: totalOnHand(await balancesOf(whApi, OVER)),
      short: totalOnHand(await balancesOf(whApi, SHORT)),
      control: totalOnHand(await balancesOf(whApi, CONTROL)),
    };

    await page.goto('/warehouse/cycle-counts');
    await expect(page.getByRole('heading', { name: 'Cycle counts' })).toBeVisible();
    const existing = (await whApi.get('/cycle-counts')).length;
    await page.getByRole('button', { name: 'New count' }).first().click();
    await expectToast(page, 'Cycle count created');
    const counts = await whApi.get('/cycle-counts');
    expect(counts.length).toBe(existing + 1);
    const cc = counts[0];
    expect(cc.status).toBe('DRAFT');
    const row = page.locator('tbody tr').filter({ hasText: cc.countNumber });
    await expect(row).toContainText('WH-RM-01');
    await row.getByRole('button', { name: 'Start' }).click();
    await expectToast(page, 'Count started');
    await expect(row.getByRole('button', { name: 'Start' })).toHaveCount(0);
    await row.getByRole('button', { name: 'Count' }).click();

    const drawer = dialog(page, `Count ${cc.countNumber}`);
    await expect(drawer).toBeVisible();
    const full = await whApi.get(`/cycle-counts/${cc._id}`);
    const sys = (code: string) => full.lines.find((l: { materialId?: { materialCode?: string } }) => l.materialId?.materialCode === code).systemQty as number;
    expect(sys(OVER)).toBe(before.over);
    expect(sys(SHORT)).toBe(before.short);
    const overInput = drawer.getByRole('spinbutton', { name: `Counted ${OVER}` });
    const shortInput = drawer.getByRole('spinbutton', { name: `Counted ${SHORT}` });
    await expect(overInput).toHaveValue(String(sys(OVER)));
    await overInput.fill(String(sys(OVER) + 5));
    await shortInput.fill(String(sys(SHORT) - 3));
    const overRow = drawer.locator('tbody tr').filter({ has: page.getByRole('spinbutton', { name: `Counted ${OVER}` }) });
    const shortRow = drawer.locator('tbody tr').filter({ has: page.getByRole('spinbutton', { name: `Counted ${SHORT}` }) });
    await expect(overRow).toContainText('+5');
    await expect(overRow).toContainText('Over');
    await expect(shortRow).toContainText('-3');
    await expect(shortRow).toContainText('Short');
    await expect(drawer.getByLabel('Post differences to inventory')).toBeChecked();
    await drawer.getByRole('button', { name: 'Complete count' }).click();
    const conf = page.getByRole('alertdialog');
    await expect(conf).toContainText('2 line(s) with differences will be adjusted');
    await confirmDialog(page, 'Complete count');
    await expectToast(page, 'Cycle count completed');
    await expect(drawer).toBeHidden();

    // Inventory moved by exactly the variance; untouched lines unchanged.
    expect(totalOnHand(await balancesOf(whApi, OVER))).toBe(round3(before.over + 5));
    expect(totalOnHand(await balancesOf(whApi, SHORT))).toBe(round3(before.short - 3));
    expect(totalOnHand(await balancesOf(whApi, CONTROL))).toBe(before.control);
    const done = await whApi.get(`/cycle-counts/${cc._id}`);
    expect(done.status).toBe('COMPLETED');

    // The completed count can no longer be opened for counting…
    await expect(row.getByRole('button', { name: 'Count' })).toHaveCount(0);
    await expect(row).toContainText(/Completed/i);
    // …and a second completion is refused (no double adjustment).
    const msg = await apiPostError(request, wh.session, `/cycle-counts/${cc._id}/complete`, {
      lines: done.lines.map((l: { materialId?: { _id: string }; countedQty: number }) => ({ materialId: l.materialId?._id, countedQty: l.countedQty + 100 })),
      applyAdjustments: true,
    });
    expect(msg).toMatch(/IN_PROGRESS|already completed/i);
    expect(totalOnHand(await balancesOf(whApi, OVER))).toBe(round3(before.over + 5));

    // Movements tab shows both adjustments with direction and the count reference.
    await page.goto('/inventory?tab=movements');
    await page.getByLabel('Movement type').selectOption('ADJUSTMENT');
    const adjOver = page.locator('tbody tr').filter({ hasText: OVER }).filter({ hasText: cc.countNumber }).first();
    const adjShort = page.locator('tbody tr').filter({ hasText: SHORT }).filter({ hasText: cc.countNumber }).first();
    await expect(adjOver).toBeVisible();
    await expect(adjOver.locator('td').nth(3)).toHaveText(/^\+5\b/);
    await expect(adjShort.locator('td').nth(3)).toHaveText(/^−3\b/);
    await expect(adjOver).toContainText(`Cycle count ${cc.countNumber}`);

    wh.problems.assertNone();
    await wh.context.close();
  });
});

/* ───────────── 4. Reports + CSV ───────────── */

const rp: { wasteCode?: string; prNumber?: string } = {};

test.describe.serial('Reports and CSV exports', () => {
  test('known records: a waste record (UI) and a requisition (API)', async ({ browser, request }) => {
    const ad = await loginAs(browser, request, 'admin');
    const page = ad.page;
    await page.goto('/waste');
    await page.getByRole('button', { name: 'Record waste' }).first().click();
    const d = dialog(page, 'Record waste');
    await d.getByRole('spinbutton', { name: /^Quantity/ }).fill('7');
    await d.getByRole('combobox', { name: /^Unit/ }).selectOption('PIECES');
    await d.getByLabel('Unit cost').fill('13');
    await d.getByRole('button', { name: 'Record waste' }).click();
    await expectToast(page, /Waste WST-.* recorded/);
    rp.wasteCode = (await page.locator('.erp-toast[role="status"]').filter({ hasText: /Waste WST-/ }).first().innerText()).match(/WST-[A-Z0-9-]+/)![0];

    const admin = api(request, ad.session);
    const mats = await admin.get('/materials', { limit: 50 });
    const mat = mats.find((m: { materialCode: string }) => m.materialCode === 'FAB-LIN-001');
    const pr = await admin.post('/purchase-requisitions', { lines: [{ materialId: mat._id, requiredQty: 11, unit: mat.unit, estimatedUnitCost: 20 }] });
    rp.prNumber = pr.prNumber;
    expect(rp.prNumber).toBeTruthy();
    ad.problems.assertNone();
    await ad.context.close();
  });

  test('report tabs and dashboard show the same figures as the API', async ({ browser, request }) => {
    test.setTimeout(180_000);
    const ad = await loginAs(browser, request, 'admin');
    const admin = api(request, ad.session);
    const page = ad.page;

    // Waste
    const waste = await admin.get('/reports/waste');
    await page.goto('/reports/waste');
    await expect(tile(page, 'Waste records').value).toHaveText(NUM.format(waste.count));
    await expect(tile(page, 'Recovered').value).toHaveText(NUM.format(waste.recovered));
    expect(await tileRupees(page, 'Total cost')).toBe(Math.round(waste.totalCost));
    const wasteRecords = await apiList(request, ad.session, '/waste-records', { limit: 500 });
    expect(waste.count).toBe(wasteRecords.total);
    expect(Math.round(waste.totalCost)).toBe(Math.round(wasteRecords.data.reduce((s, r) => s + Number(r.totalCost || 0), 0)));

    // Purchase
    const pur = await admin.get('/reports/purchase');
    await page.getByRole('tab', { name: 'Purchase' }).click();
    await expect(tile(page, 'Receipts awaiting QC').value).toHaveText(NUM.format(pur.grnPendingQc));
    await expect(tile(page, 'Suppliers').value).toHaveText(NUM.format(pur.suppliers));
    await expect(tile(page, 'Unpaid payments').value).toHaveText(NUM.format(pur.poOpen));
    const prSection = page.getByRole('heading', { name: 'Requisitions by status' }).locator('xpath=ancestor::*[.//table][1]');
    for (const [status, count] of Object.entries(pur.prByStatus as Record<string, number>)) {
      const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
      await expect(prSection.locator('tr').filter({ hasText: new RegExp(`^${label}`, 'i') }).locator('td').nth(1)).toHaveText(NUM.format(count));
    }
    const submittedPrs = await apiList(request, ad.session, '/purchase-requisitions', { status: 'DRAFT', limit: 1 });
    expect(pur.prByStatus.DRAFT ?? 0).toBe(submittedPrs.total);

    // Quality
    const q = await admin.get('/reports/quality');
    await page.getByRole('tab', { name: 'Quality' }).click();
    await expect(tile(page, 'Passed').value).toHaveText(NUM.format(q.passed));
    await expect(tile(page, 'Pending inspections').value).toHaveText(NUM.format(q.pending));
    await expect(tile(page, 'Open CAPA').value).toHaveText(NUM.format(q.openCapa));
    const insp = await apiList(request, ad.session, '/quality-inspections', { limit: 500 });
    expect(q.passed).toBe(insp.data.filter((i) => i.result === 'PASS').length);
    expect(q.pending).toBe(insp.data.filter((i) => i.status === 'PENDING').length);

    // Inventory
    const inv = await admin.get('/reports/inventory');
    await page.getByRole('tab', { name: 'Inventory' }).click();
    await expect(tile(page, 'Materials').value).toHaveText(NUM.format(inv.materialCount));
    await expect(tile(page, 'Dispatch ready').value).toHaveText(NUM.format(inv.dispatchReady));
    await expect(tile(page, 'Low stock').value).toHaveText(NUM.format(inv.lowStock));
    const rmRows = await admin.get('/inventory/balances', { inventoryType: 'RAW_MATERIAL', limit: 500 });
    expect(round3(rmRows.reduce((s: number, r: { onHand?: number }) => s + (r.onHand || 0), 0))).toBe(round3(inv.rmOnHand));

    // Production
    const prod = await admin.get('/reports/production');
    await page.getByRole('tab', { name: 'Production' }).click();
    await expect(tile(page, 'Planned qty').value).toHaveText(NUM.format(prod.totalPlannedQty));
    await expect(tile(page, 'Batches in progress').value).toHaveText(NUM.format(prod.batchesInProgress));
    const running = await apiList(request, ad.session, '/batches', { limit: 500 });
    expect(prod.batchesInProgress).toBe(running.data.filter((b) => b.status === 'IN_PROGRESS' || b.status === 'REWORK').length);

    // Employee: role names, never raw ids
    await page.getByRole('tab', { name: /Employee|People/ }).click();
    await expect(page.getByText('People by role')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/[a-f0-9]{24}/);

    // Dashboard KPIs
    const stats = await admin.get('/reports/stats');
    await page.goto('/');
    await expect(tile(page, 'Active batches').value).toHaveText(NUM.format(stats.production.batchesInProgress));
    await expect(tile(page, 'Dispatch ready').value).toHaveText(NUM.format(stats.warehouse?.dispatchReady ?? 0));
    expect(await tileRupees(page, 'Stock value')).toBe(Math.round(stats.inventory.stockValue));

    ad.problems.assertNone();
    await ad.context.close();
  });

  test('CSV exports: purchase, inventory, waste and reports match the lists', async ({ browser, request }) => {
    test.setTimeout(180_000);
    const ad = await loginAs(browser, request, 'admin');
    const page = ad.page;

    /* Purchase — requisitions (default "All open") */
    await page.goto('/purchase');
    const prTotal = (await apiList(request, ad.session, '/purchase-requisitions', { status: 'DRAFT,SUBMITTED,APPROVED,REJECTED', limit: 1 })).total;
    let csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export' }).click());
    expect(csv.filename).toBe('purchase-requisitions.csv');
    assertCleanCsv(csv, 'PR export');
    expect(csv.headers).toEqual(['Requisition', 'Date', 'Status', 'Est. value', 'Items']);
    expect(csv.rows.length).toBe(prTotal);
    // Every visible UI row is in the file with the same status / value.
    const uiRows = page.locator('tbody tr').filter({ has: page.locator('.font-mono') });
    const n = await uiRows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const r = uiRows.nth(i);
      const num = (await r.locator('td').first().innerText()).match(/PR-[A-Z0-9-]+/)?.[0];
      if (!num) continue;
      const line = csv.rows.find((c) => c[0] === num);
      expect(line, `${num} in CSV`).toBeTruthy();
      const statusText = (await r.locator('td').nth(3).locator('.erp-badge, [class*="badge"]').first().innerText()).trim();
      expect(csv.col(line!, 'Status')).toBe(statusText);
      expect(Number(csv.col(line!, 'Est. value'))).toBe(digits(await r.locator('td').nth(2).innerText()));
      expect(csv.col(line!, 'Date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // Search filter is honoured: exactly the PR searched for.
    await page.getByPlaceholder('Search PR number…').fill(rp.prNumber!);
    await expect(page.locator('tbody tr').filter({ hasText: rp.prNumber! })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export' }).click());
    expect(csv.rows.length).toBe(1);
    expect(csv.col(csv.rows[0], 'Requisition')).toBe(rp.prNumber);
    expect(csv.col(csv.rows[0], 'Est. value')).toBe('220');
    expect(csv.col(csv.rows[0], 'Items')).toContain('FAB-LIN-001');
    expect(csv.col(csv.rows[0], 'Items')).toContain('11');

    /* Purchase — payments */
    await page.getByRole('tab', { name: /^Payments/ }).click();
    const poTotal = (await apiList(request, ad.session, '/purchase-orders', { status: 'DRAFT,APPROVED,SENT,PARTIAL,RECEIVED,CLOSED', limit: 1 })).total;
    csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export' }).click());
    expect(csv.filename).toBe('purchase-payments.csv');
    assertCleanCsv(csv, 'PO export');
    expect(csv.rows.length).toBe(poTotal);
    for (const r of csv.rows) {
      expect(csv.col(r, 'Supplier')).toMatch(/ — /);
      expect(['Paid', 'Unpaid', '']).toContain(csv.col(r, 'Payment status'));
      expect(Number.isFinite(Number(csv.col(r, 'Amount')))).toBeTruthy();
    }

    /* Purchase — goods receipts */
    await page.getByRole('tab', { name: /^Goods receipts/ }).click();
    const grnTotal = (await apiList(request, ad.session, '/goods-receipts', { status: 'DRAFT,PENDING_QC,COMPLETED', limit: 1 })).total;
    csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export' }).click());
    assertCleanCsv(csv, 'GRN export');
    expect(csv.rows.length).toBe(grnTotal);
    for (const r of csv.rows) expect(csv.col(r, 'Payment')).toMatch(/^PO-/);

    /* Inventory stock */
    await page.goto('/inventory');
    const balTotal = (await apiList(request, ad.session, '/inventory/balances', { limit: 1 })).total;
    csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export' }).click());
    expect(csv.filename).toBe('inventory-stock.csv');
    assertCleanCsv(csv, 'Inventory export');
    expect(csv.rows.length).toBe(balTotal);
    const invUi = page.locator('tbody tr');
    for (let i = 0; i < Math.min(await invUi.count(), 10); i++) {
      const tds = invUi.nth(i).locator('td');
      const material = (await tds.nth(0).innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
      const onHand = digits(await tds.nth(2).innerText());
      const location = (await tds.nth(1).innerText()).trim();
      const line = csv.rows.find((c) => material.every((m) => csv.col(c, 'Material').includes(m)) && csv.col(c, 'Location') === location);
      expect(line, `${material.join(' ')} @ ${location} in CSV`).toBeTruthy();
      expect(Number(csv.col(line!, 'On hand'))).toBeCloseTo(onHand, 3);
      expect(Number(csv.col(line!, 'Available'))).toBeCloseTo(digits(await tds.nth(4).innerText()), 3);
    }

    /* Waste — filtered to the known record */
    await page.goto('/waste');
    const wasteTotal = (await apiList(request, ad.session, '/waste-records', { limit: 1 })).total;
    csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export' }).click());
    assertCleanCsv(csv, 'Waste export');
    expect(csv.rows.length).toBe(wasteTotal);
    await page.getByPlaceholder('Search waste code…').fill(rp.wasteCode!);
    const wRow = page.locator('tbody tr').filter({ hasText: rp.wasteCode! });
    await expect(wRow).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export' }).click());
    expect(csv.headers.slice(0, 3)).toEqual(['Code', 'Type', 'Material / SKU']);
    expect(csv.rows.length).toBe(1);
    const w = csv.rows[0];
    expect(csv.col(w, 'Code')).toBe(rp.wasteCode);
    expect(csv.col(w, 'Quantity')).toBe('7');
    expect(csv.col(w, 'Unit cost')).toBe('13');
    expect(csv.col(w, 'Total cost')).toBe('91');
    expect(csv.col(w, 'Status')).toBe('Awaiting recovery');
    const uiType = (await wRow.locator('td').nth(1).innerText()).trim();
    expect(csv.col(w, 'Type')).toBe(uiType);
    expect(digits(await wRow.locator('td').nth(4).innerText())).toBe(91);
    expect(csv.col(w, 'Recorded at (UTC)')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    /* Reports */
    for (const tab of ['waste', 'factory', 'employee', 'financial'] as const) {
      await page.goto(`/reports/${tab}`);
      csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export CSV' }).click());
      expect(csv.filename).toBe(`${tab}-report.csv`);
      assertCleanCsv(csv, `${tab} report`);
      expect(csv.headers).toEqual(['Section', 'Metric', 'Value']);
      for (const r of csv.rows) expect(r[1], `${tab}: metric label`).not.toMatch(/^[a-z]+[A-Z]|\.|^[A-Z_]{4,}$/);
    }
    const wasteRep = await api(request, ad.session).get('/reports/waste');
    await page.goto('/reports/waste');
    csv = await downloadCsvFrom(page, () => page.getByRole('button', { name: 'Export CSV' }).click());
    expect(csv.rows.find((r) => r[1] === 'Waste records')?.[2]).toBe(String(wasteRep.count));
    expect(csv.rows.find((r) => r[1] === 'Total cost')?.[2]).toBe(String(wasteRep.totalCost));

    ad.problems.assertNone([/report exported|Export downloaded/]);
    await ad.context.close();
  });
});

/* ───────────── 5. Chat ───────────── */

const bell = (page: Page) => page.getByRole('button', { name: /^Messages(,|$)/ });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Messages' });

async function expectUnread(page: Page, n: number) {
  // 8s ≪ the 30s stats poll: only a live socket push gets the badge there in time.
  await expect(bell(page)).toHaveAttribute('aria-label', n ? `Messages, ${n} unread` : 'Messages', { timeout: 8_000 });
}

test.describe.serial('Real-time chat', () => {
  test('direct message between admin and planner arrives live both ways', async ({ browser, request }) => {
    const a = await loginAs(browser, request, 'admin');
    const b = await loginAs(browser, request, 'planner');
    await b.page.goto('/production/orders');
    await expect(bell(b.page)).toBeVisible();
    const plannerApi = api(request, b.session);
    const bStart = (await plannerApi.get('/chat/stats')).unreadTotal as number;
    await expectUnread(b.page, bStart);

    await a.page.goto('/');
    const aStart = (await api(request, a.session).get('/chat/stats')).unreadTotal as number;
    await bell(a.page).click();
    const ap = panel(a.page);
    await expect(ap).toBeVisible();
    const picker = ap.getByLabel('Start a conversation with');
    await picker.selectOption({ label: 'Production Planner' });
    await ap.getByRole('button', { name: 'Chat', exact: true }).click();
    const text1 = `Hi planner ${uniq('DM')}`;
    const input = ap.getByPlaceholder('Write a message…');
    await input.fill(text1);
    await input.press('Enter');
    // The sender sees their own message in the open thread.
    await expect(ap.locator('.chat-panel-thread').getByText(text1)).toBeVisible();

    // B: badge increments without reload; opening shows the message and clears that room's unread.
    await expectUnread(b.page, bStart + 1);
    await bell(b.page).click();
    const bp = panel(b.page);
    const room = bp.getByRole('button').filter({ hasText: 'Factory Admin' }).filter({ hasText: text1 }).first();
    await expect(room).toBeVisible();
    await room.click();
    await expect(bp.locator('.chat-panel-thread').getByText(text1)).toBeVisible();
    const rooms: { _id: string; type: string; lastMessagePreview?: string; unreadCount?: number }[] = await plannerApi.get('/chat/rooms', { limit: 100 });
    const dm = rooms.find((r) => r.lastMessagePreview?.includes(text1));
    expect(dm?.unreadCount ?? 0).toBe(0);
    const bAfterOpen = (await plannerApi.get('/chat/stats')).unreadTotal as number;
    expect(bAfterOpen).toBeLessThanOrEqual(bStart);
    await expectUnread(b.page, bAfterOpen);

    // B replies; A (thread open) sees it live and does not count it as unread.
    const text2 = `Got it ${uniq('RE')}`;
    const bInput = bp.getByPlaceholder('Write a message…');
    await bInput.fill(text2);
    await bp.getByRole('button', { name: 'Send message' }).click();
    await expect(bp.locator('.chat-panel-thread').getByText(text2)).toBeVisible();
    await expect(ap.locator('.chat-panel-thread').getByText(text2)).toBeVisible({ timeout: 8_000 });
    await a.page.waitForTimeout(1500);
    await expectUnread(a.page, aStart);
    // B's own reply never counts as unread for B.
    await expectUnread(b.page, bAfterOpen);

    a.problems.assertNone();
    b.problems.assertNone();
    await a.context.close();
    await b.context.close();
  });

  test('group chat with three members delivers live to the other two', async ({ browser, request }) => {
    const a = await loginAs(browser, request, 'admin');
    const b = await loginAs(browser, request, 'planner');
    const c = await loginAs(browser, request, 'qc');
    await b.page.goto('/');
    await c.page.goto('/');
    await expect(bell(b.page)).toBeVisible();
    await expect(bell(c.page)).toBeVisible();
    const bStart = (await api(request, b.session).get('/chat/stats')).unreadTotal as number;
    const cStart = (await api(request, c.session).get('/chat/stats')).unreadTotal as number;
    await expectUnread(b.page, bStart);
    await expectUnread(c.page, cStart);

    await a.page.goto('/');
    await bell(a.page).click();
    const ap = panel(a.page);
    await ap.getByRole('button', { name: 'New group' }).click();
    const gm = dialog(a.page, 'New group');
    const groupName = uniq('Line 2 huddle');
    await gm.getByLabel('Group name').fill(groupName);
    await gm.getByRole('checkbox', { name: 'Production Planner' }).check();
    await gm.getByRole('checkbox', { name: 'Quality Inspector' }).check();
    await gm.getByRole('button', { name: 'Create group' }).click();
    await expect(gm).toBeHidden();
    await expect(ap.getByText('3 members')).toBeVisible();
    const text = `Shift change at 2pm ${uniq('G')}`;
    const input = ap.getByPlaceholder('Write a message…');
    await input.fill(text);
    await input.press('Enter');
    await expect(ap.locator('.chat-panel-thread').getByText(text)).toBeVisible();

    for (const [u, start] of [[b, bStart], [c, cStart]] as const) {
      await expectUnread(u.page, start + 1);
      await bell(u.page).click();
      const p = panel(u.page);
      const room = p.getByRole('button').filter({ hasText: groupName }).first();
      await expect(room).toBeVisible();
      await room.click();
      await expect(p.locator('.chat-panel-thread').getByText(text)).toBeVisible();
      await expect(p.getByText('3 members')).toBeVisible();
      await expectUnread(u.page, start);
    }

    // A member's reply reaches the others live.
    const reply = `On it ${uniq('R')}`;
    const cp = panel(c.page);
    await cp.getByPlaceholder('Write a message…').fill(reply);
    await cp.getByPlaceholder('Write a message…').press('Enter');
    await expect(ap.locator('.chat-panel-thread').getByText(reply)).toBeVisible({ timeout: 8_000 });
    await expect(panel(b.page).locator('.chat-panel-thread').getByText(reply)).toBeVisible({ timeout: 8_000 });

    for (const u of [a, b, c]) {
      u.problems.assertNone();
      await u.context.close();
    }
  });
});
