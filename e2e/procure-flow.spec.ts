import { test, expect, type Browser, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { api, apiLogin, expectToast, loginAs, uniq, type RoleKey } from './helpers';

/**
 * Procure-to-stock, driven through the UI role by role:
 * material → alert → request purchase / multi-line PR → request changes → edit + resubmit → approve
 * → payment → partial GRN → QC (accept/reject) → dock stock, PO partial → replacement GRN → QC
 * → PO received → finance marks paid → put-away → movements; manual holds; vendors; cancellations.
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:5322 E2E_API_URL=http://localhost:3322/api/v1 \
 *     npx playwright test e2e/procure-flow.spec.ts --workers=1
 */

type Actor = Awaited<ReturnType<typeof loginAs>>;
const actors: Partial<Record<RoleKey, Actor>> = {};

async function as(browser: Browser, request: APIRequestContext, role: RoleKey): Promise<Actor> {
  if (!actors[role]) actors[role] = await loginAs(browser, request, role);
  const a = actors[role]!;
  a.problems.clear();
  return a;
}

const MAT_CODE = uniq('E2E-RM');
const MAT_NAME = `E2E Twill ${MAT_CODE.slice(-5)}`;
const VENDOR_CODE = uniq('V-E2E');
const state: {
  materialId?: string;
  alertPr?: string;
  multiPr?: string;
  cancelPr?: string;
  po?: string;
  poId?: string;
  grn1?: string;
  grn2?: string;
  bin?: string;
} = {};

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const dialog = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name });
const alertDialog = (page: Page) => page.getByRole('alertdialog');

/** ErpSearchSelect: open the trigger, type, pick the option. */
async function pickOption(trigger: Locator, text: string | RegExp) {
  await trigger.click();
  const page = trigger.page();
  const panel = page.locator('[data-erp-search-panel="true"]');
  await panel.getByLabel('Filter options').fill(typeof text === 'string' ? text : '');
  await panel.getByRole('option', { name: text }).first().click();
  await expect(panel).toHaveCount(0);
}

function row(page: Page, text: string | RegExp) {
  return page.getByRole('row').filter({ hasText: text });
}

async function rowMenu(r: Locator, item: string | RegExp) {
  await r.getByRole('button', { name: 'More actions' }).click();
  await r.page().getByRole('menuitem', { name: item }).click();
}

/** Numeric value of a KPI tile once it has loaded (tiles show "—" while fetching). */
async function num(value: Locator) {
  await expect(value).toHaveText(/^\d+$/);
  return Number(await value.innerText());
}

async function tileValue(page: Page, label: string) {
  const tile = page.locator('.erp-stat-tile').filter({ has: page.locator('.erp-kpi-label', { hasText: label }) }).first();
  return tile.locator('.erp-kpi-value');
}

test.describe.serial('Procure to stock', () => {
  test.afterAll(async () => {
    for (const a of Object.values(actors)) await a?.context.close();
  });

  test('inventory manager adds a material (shows as out-of-stock alert)', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'inventory');
    await page.goto('/inventory?tab=materials');
    await page.getByRole('button', { name: 'Add material', exact: true }).first().click();
    const d = dialog(page, 'Add material');
    await d.getByLabel('Code').fill(MAT_CODE);
    await d.getByLabel('Name').fill(MAT_NAME);
    await d.getByLabel('Unit cost').fill('120');
    await d.getByLabel('Reorder level').fill('50');
    await d.getByRole('button', { name: 'Add material' }).click();
    await expectToast(page, 'Material added');
    await expect(d).toHaveCount(0);
    await expect(row(page, MAT_CODE)).toBeVisible();
    // Low-stock tile counts it without a reload
    await expect(await tileValue(page, 'Low stock')).toHaveText(/[1-9]/);
    problems.assertNone();
  });

  test('store keeper requests purchase from Inventory alerts', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await page.goto('/inventory');
    await page.getByRole('tab', { name: /Alerts/ }).click();
    const r = row(page, MAT_CODE);
    await expect(r).toBeVisible();
    await expect(r).toContainText('Out of stock');
    await r.getByRole('button', { name: 'Request' }).click();
    const d = dialog(page, 'Request purchase');
    await expect(d.getByLabel('Quantity to buy')).not.toHaveValue('');
    await d.getByLabel('Quantity to buy').fill('80');
    await d.getByRole('button', { name: 'Send for approval' }).click();
    await expectToast(page, /sent for approval/);
    await expect(r).toContainText(/Requested on PR-/);
    await expect(r.getByRole('button', { name: 'Request' })).toHaveCount(0);
    state.alertPr = (await r.getByRole('link', { name: /PR-/ }).innerText()).trim();
    problems.assertNone();
  });

  test('store keeper raises a 2-line requisition as draft, then submits it', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await page.goto('/purchase');
    await page.getByRole('button', { name: 'New requisition' }).first().click();
    const d = dialog(page, 'New purchase requisition');
    await pickOption(d.getByLabel('Material').first(), MAT_CODE);
    await d.getByLabel('Quantity').first().fill('100');
    await d.getByRole('button', { name: 'Add another material' }).click();
    await pickOption(d.getByLabel('Material').nth(1), 'BTN-001');
    await d.getByLabel('Quantity').nth(1).fill('500');
    await d.getByRole('button', { name: 'Save as draft' }).click();
    await expectToast(page, /saved as draft/);
    await expect(d).toHaveCount(0);

    const draftRow = page.getByRole('row').filter({ hasText: 'Not submitted yet' }).filter({ hasText: MAT_CODE }).first();
    await expect(draftRow).toBeVisible();
    state.multiPr = (await draftRow.locator('.erp-cell-primary').innerText()).trim();
    await expect(draftRow).toContainText('BTN-001');

    const toApprove = await tileValue(page, 'Waiting for approval') // the store keeper's tile; approvers see 'To approve';
    const before = await num(toApprove);
    await draftRow.getByRole('button', { name: 'Submit' }).click();
    await expectToast(page, `${state.multiPr} sent for approval`);
    await expect(toApprove).toHaveText(String(before + 1));
    problems.assertNone();
  });

  test('factory admin requests changes from the Approvals inbox', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'admin');
    await page.goto('/approvals');
    const item = page.getByRole('listitem').filter({ hasText: state.multiPr! });
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Request changes' }).click();
    const d = page.getByRole('dialog', { name: new RegExp(`Request changes on ${state.multiPr}`) });
    await d.getByRole('textbox').fill('Reduce buttons to 300 pieces');
    await d.getByRole('button', { name: 'Send back' }).click();
    await expectToast(page, /sent back for changes/);
    await expect(item).toHaveCount(0);
    problems.assertNone();
  });

  test('store keeper sees the comment, edits the requisition and resubmits', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    // Notification reaches the requester
    await page.goto('/purchase');
    await page.getByTitle('Notifications').click();
    await expect(page.getByRole('button', { name: /PR changes requested/ }).first()).toBeVisible();
    await page.getByTitle('Notifications').click();

    const r = row(page, state.multiPr!);
    await expect(r).toContainText('Changes requested: Reduce buttons to 300 pieces');
    await r.getByRole('button', { name: 'Edit & resubmit' }).click();
    const d = dialog(page, `Edit ${state.multiPr}`);
    await expect(d).toContainText('Reduce buttons to 300 pieces');
    await expect(d.getByLabel('Quantity').nth(1)).toHaveValue('500');
    await d.getByLabel('Quantity').nth(1).fill('300');
    await d.getByRole('button', { name: 'Save & resubmit' }).click();
    await expectToast(page, `${state.multiPr} sent for approval`);
    await expect(d).toHaveCount(0);
    await expect(r).toContainText('BTN-001');
    await expect(r).toContainText('300');
    await expect(r).not.toContainText('Changes requested');
    problems.assertNone();
  });

  test('factory admin approves from the Purchase "To approve" tile', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'admin');
    await page.goto('/purchase');
    // Approver was notified
    await page.getByTitle('Notifications').click();
    // (Known gap, approval module: the message does not name the PR number.)
    await expect(page.getByRole('button', { name: /Purchase requisition awaiting approval/ }).first()).toBeVisible();
    await page.getByTitle('Notifications').click();

    await page.locator('.erp-stat-tile', { hasText: 'To approve' }).click();
    await expect(page.getByLabel('Status')).toHaveValue('SUBMITTED');
    const r = row(page, state.multiPr!);
    await expect(r).toContainText('300');
    const ready = await tileValue(page, 'Ready to pay');
    const readyBefore = await num(ready);
    await r.getByRole('button', { name: 'Approve' }).click();
    await expectToast(page, `${state.multiPr} approved`);
    await expect(ready).toHaveText(String(readyBefore + 1));
    // Also approve the alert requisition from the inbox
    await page.goto('/approvals');
    const item = page.getByRole('listitem').filter({ hasText: state.alertPr! });
    await item.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog', { name: new RegExp(`Approve ${state.alertPr}`) }).getByRole('button', { name: 'Approve' }).click();
    await expectToast(page, /approved/);
    problems.assertNone();
  });

  test('purchase manager creates the payment from the approved requisition', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'purchase');
    await page.goto('/purchase');
    await page.locator('.erp-stat-tile', { hasText: 'Ready to pay' }).click();
    const r = row(page, state.multiPr!);
    await r.getByRole('button', { name: 'Create payment' }).click();
    const d = dialog(page, 'Create payment');
    await expect(d.getByLabel('Approved requisition')).toContainText(state.multiPr!);
    await pickOption(d.getByLabel('Supplier'), 'Aggarwal Textile');
    await d.getByLabel(`Unit price for ${MAT_CODE}`, { exact: false }).fill('110');
    await expect(d).toContainText('₹');
    await d.getByRole('button', { name: 'Create payment' }).click();
    await expectToast(page, 'Payment created');
    await expect(d).toHaveCount(0);
    // Lands on Payments with the new row highlighted
    const poRow = page.locator('tr.erp-row-selected');
    await expect(poRow).toContainText(state.multiPr!);
    await expect(poRow).toContainText('Aggarwal Textile');
    state.po = (await poRow.locator('.erp-cell-primary').innerText()).trim();
    await expect(poRow).toContainText('Unpaid');
    problems.assertNone();
  });

  test('store keeper receives a partial GRN and submits it for QC', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await page.goto('/purchase?tab=po');
    const r = row(page, state.po!);
    await r.getByRole('button', { name: 'Receive goods' }).click();
    const d = dialog(page, 'Receive goods');
    await expect(d.getByLabel('Payment')).toContainText(state.po!);
    await d.getByLabel(`Received quantity for ${MAT_CODE}`).fill('60');
    await expect(d.getByLabel('Received quantity for BTN-001')).toHaveValue('300');
    await d.getByRole('button', { name: 'Record receipt' }).click();
    await expectToast(page, 'Goods receipt recorded');
    const g = page.locator('tr.erp-row-selected');
    await expect(g).toContainText(state.po!);
    state.grn1 = (await g.locator('.erp-cell-primary').innerText()).trim();
    const awaiting = await tileValue(page, 'Awaiting QC');
    const before = await num(awaiting);
    await g.getByRole('button', { name: 'Submit for QC' }).click();
    await expectToast(page, `${state.grn1} sent to incoming QC`);
    await expect(awaiting).toHaveText(String(before + 1));
    await expect(row(page, state.grn1!)).toContainText(/Pending QC|Awaiting QC/i);
    problems.assertNone();
  });

  test('QC inspector accepts some, rejects some', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'qc');
    await page.goto('/quality');
    await page.getByTitle('Notifications').click();
    await expect(page.getByRole('button', { name: new RegExp(`Incoming QC pending.*${state.grn1}`) }).first()).toBeVisible();
    await page.getByTitle('Notifications').click();

    await page.getByRole('tab', { name: /Incoming/ }).click();
    const r = row(page, state.grn1!);
    await r.getByRole('button', { name: 'Inspect' }).click();
    const d = page.getByRole('dialog', { name: /Complete/ });
    await d.getByLabel(`Accepted ${MAT_CODE}`).fill('50');
    await expect(d.getByLabel(`Rejected ${MAT_CODE}`)).toHaveValue('10');
    await d.getByLabel('Accepted BTN-001').fill('300');
    await d.getByRole('button', { name: 'Complete inspection' }).click();
    const confirm = alertDialog(page);
    await expect(confirm).toContainText('350 accepted');
    await confirm.getByRole('button').last().click();
    await expectToast(page, /stock|complete/i);
    await expect(row(page, state.grn1!)).toHaveCount(0);
    problems.assertNone();
  });

  test('stock is on the dock and the payment is Partial', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await page.goto('/inventory?tab=stock');
    const r = row(page, MAT_CODE).filter({ hasText: /dock/i });
    await expect(r).toBeVisible();
    await expect(r.locator('td').nth(2)).toContainText('50');
    await page.goto('/purchase?tab=po');
    const p = row(page, state.po!);
    await expect(p).toContainText(/Partial/i);
    await expect(p.getByRole('button', { name: 'Receive goods' })).toBeVisible();
    problems.assertNone();
  });

  test('replacement GRN for the remainder → QC pass → payment Received', async ({ browser, request }) => {
    const store = await as(browser, request, 'store');
    let page = store.page;
    await page.goto('/purchase?tab=po');
    await row(page, state.po!).getByRole('button', { name: 'Receive goods' }).click();
    const d = dialog(page, 'Receive goods');
    await expect(d.getByLabel(`Received quantity for ${MAT_CODE}`)).toHaveValue('50');
    await expect(d.getByLabel('Received quantity for BTN-001')).toHaveCount(0);
    await d.getByRole('button', { name: 'Record receipt' }).click();
    await expectToast(page, 'Goods receipt recorded');
    const g = page.locator('tr.erp-row-selected');
    state.grn2 = (await g.locator('.erp-cell-primary').innerText()).trim();
    await g.getByRole('button', { name: 'Submit for QC' }).click();
    await expectToast(page, `${state.grn2} sent to incoming QC`);
    store.problems.assertNone();

    const qc = await as(browser, request, 'qc');
    page = qc.page;
    await page.goto('/quality');
    await page.getByRole('tab', { name: /Incoming/ }).click();
    await row(page, state.grn2!).getByRole('button', { name: 'Inspect' }).click();
    const qd = page.getByRole('dialog', { name: /Complete/ });
    await expect(qd.getByLabel(`Accepted ${MAT_CODE}`)).toHaveValue('50');
    await qd.getByRole('button', { name: 'Complete inspection' }).click();
    await alertDialog(page).getByRole('button').last().click();
    await expect(row(page, state.grn2!)).toHaveCount(0);
    qc.problems.assertNone();

    page = store.page;
    await page.goto('/purchase?tab=po');
    await expect(row(page, state.po!)).toContainText(/Received/);
    await expect(row(page, state.po!).getByRole('button', { name: 'Receive goods' })).toHaveCount(0);
    store.problems.assertNone();
  });

  test('finance marks the payment paid', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'finance');
    await page.goto('/purchase');
    // Finance lands on unpaid payments
    await expect(page.getByLabel('Payment', { exact: true })).toHaveValue('UNPAID');
    const unpaid = await tileValue(page, 'Unpaid');
    const before = await num(unpaid);
    const r = row(page, state.po!);
    // No invoice was uploaded on the GRNs: finance is asked for it first, then confirms.
    await r.getByRole('button', { name: 'Mark paid' }).click();
    await expect(alertDialog(page)).toContainText(`Attach the invoice for ${state.po}`);
    const chooser = page.waitForEvent('filechooser');
    await alertDialog(page).getByRole('button', { name: 'Choose invoice file' }).click();
    await (await chooser).setFiles({ name: 'invoice.png', mimeType: 'image/png', buffer: TINY_PNG });
    await expectToast(page, 'Invoice uploaded');
    await expect(alertDialog(page)).toContainText(`Mark ${state.po} as paid?`);
    await alertDialog(page).getByRole('button', { name: 'Mark paid' }).click();
    await expectToast(page, `${state.po} marked as paid`);
    await expect(unpaid).toHaveText(String(before - 1));
    await expect(row(page, state.po!)).toHaveCount(0);
    problems.assertNone();
  });

  test('store keeper puts the dock stock away into a bin', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await page.goto('/inventory?tab=stock');
    const dock = row(page, MAT_CODE).filter({ hasText: /dock/i });
    await expect(dock.locator('td').nth(2)).toContainText('100');
    await dock.getByRole('button', { name: 'Put away' }).click();
    await expect(page).toHaveURL(/put-away\?materialId=/);
    const bin = page.getByRole('row').filter({ has: page.getByRole('button', { name: /^Put away 100$/ }) }).first();
    state.bin = (await bin.locator('td').first().innerText()).trim();
    await bin.getByRole('button', { name: 'Put away 100' }).click();
    // Put-away is one click now (routine, reversible) — no confirmation step.
    await expectToast(page, /put away|moved|done/i);
    // Back in Inventory: stock is in the bin, nothing on the dock for this material
    await page.goto('/inventory?tab=stock');
    await expect(row(page, MAT_CODE).filter({ hasText: state.bin })).toBeVisible();
    await expect(row(page, MAT_CODE).filter({ hasText: /dock/i })).toHaveCount(0);
    problems.assertNone();
  });

  test('movements history shows the receipts and the put-away', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await page.goto('/inventory?tab=movements');
    await pickOption(page.getByRole('button', { name: 'All materials' }), MAT_CODE);
    const rows = page.getByRole('row').filter({ hasText: MAT_CODE });
    await expect(rows.filter({ hasText: state.grn1! }).first()).toBeVisible();
    await expect(rows.filter({ hasText: state.grn2! }).first()).toBeVisible();
    await expect(rows.filter({ hasText: /put.?away|transfer/i }).first()).toBeVisible();
    problems.assertNone();
  });

  test('inventory manager reserves and releases a manual hold', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'inventory');
    await page.goto('/inventory?tab=reservations');
    const reserved = await tileValue(page, 'Reserved');
    await expect(reserved).not.toHaveText('—');
    const before = await num(reserved);
    await page.getByRole('button', { name: 'Reserve stock' }).first().click();
    const d = dialog(page, 'Reserve stock');
    await pickOption(d.getByLabel('Material'), MAT_CODE);
    await expect(d).toContainText('100 meters available');
    await d.getByLabel('Quantity').fill('15');
    await d.getByLabel('Reason').fill('E2E buyer sample');
    await d.getByRole('button', { name: 'Reserve' }).click();
    await expectToast(page, 'Stock reserved');
    const hold = row(page, 'E2E buyer sample');
    await expect(hold).toContainText(MAT_CODE);
    await expect(reserved).toHaveText(String(before + 1));
    await page.getByRole('tab', { name: /Stock/ }).first().click();
    await expect(row(page, MAT_CODE).locator('td').nth(4)).toContainText('85');
    await page.getByRole('tab', { name: 'Manual holds' }).click();
    await row(page, 'E2E buyer sample').getByRole('button', { name: 'Release' }).click();
    await alertDialog(page).getByRole('button', { name: 'Release' }).click();
    await expectToast(page, 'Hold released');
    await expect(row(page, 'E2E buyer sample')).toHaveCount(0);
    await expect(reserved).toHaveText(String(before));
    problems.assertNone();
  });

  test('vendors: create, edit, deactivate', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'purchase');
    await page.goto('/vendors');
    const inactive = await tileValue(page, 'Inactive');
    await expect(inactive).not.toHaveText('—');
    const inactiveBefore = await num(inactive);
    await page.getByRole('button', { name: 'New vendor' }).first().click();
    const d = dialog(page, 'New vendor');
    await d.getByLabel('Vendor ID').fill(VENDOR_CODE);
    await d.getByLabel('Name').fill('Zeta E2E Threads');
    await d.getByLabel('Materials supplied').fill('Thread, buttons');
    await d.getByRole('button', { name: 'Add vendor' }).click();
    await expectToast(page, 'Vendor added');
    const v = row(page, VENDOR_CODE);
    await expect(v).toBeVisible();

    await rowMenu(v, 'Edit');
    const e = dialog(page, 'Edit Zeta E2E Threads');
    await e.getByLabel('Contact person').fill('Ravi');
    await e.getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Vendor updated');
    await expect(v).toContainText('Ravi');

    await rowMenu(v, 'Deactivate');
    await alertDialog(page).getByRole('button', { name: 'Deactivate' }).click();
    await expectToast(page, 'Vendor status updated');
    await expect(v).toContainText(/Inactive/i);
    await expect(inactive).toHaveText(String(inactiveBefore + 1));
    problems.assertNone();
  });

  test('purchase cancels a draft GRN and then a fresh payment (PR back to Approved)', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'purchase');
    await page.goto('/purchase');
    await page.locator('.erp-stat-tile', { hasText: 'Ready to pay' }).click();
    await row(page, state.alertPr!).getByRole('button', { name: 'Create payment' }).click();
    const d = dialog(page, 'Create payment');
    await pickOption(d.getByLabel('Supplier'), 'JAINCO FABRICS');
    await d.getByRole('button', { name: 'Create payment' }).click();
    await expectToast(page, 'Payment created');
    const po = page.locator('tr.erp-row-selected');
    const poNo = (await po.locator('.erp-cell-primary').innerText()).trim();

    // Draft GRN, then cancel it
    await po.getByRole('button', { name: 'Receive goods' }).click();
    await dialog(page, 'Receive goods').getByRole('button', { name: 'Record receipt' }).click();
    await expectToast(page, 'Goods receipt recorded');
    const g = page.locator('tr.erp-row-selected');
    const grnNo = (await g.locator('.erp-cell-primary').innerText()).trim();
    await rowMenu(g, 'Cancel receipt');
    await alertDialog(page).getByRole('button', { name: 'Cancel receipt' }).click();
    await expectToast(page, `${grnNo} cancelled`);
    await expect(row(page, grnNo)).toHaveCount(0);

    // Cancel the payment
    await page.getByRole('tab', { name: /Payments/ }).click();
    const ready = await tileValue(page, 'Ready to pay');
    const readyBefore = await num(ready);
    await rowMenu(row(page, poNo), 'Cancel payment');
    await page.getByRole('dialog', { name: `Cancel payment ${poNo}?` }).getByRole('button', { name: 'Cancel payment' }).click();
    await expectToast(page, `${poNo} cancelled`);
    await expect(ready).toHaveText(String(readyBefore + 1));
    await page.locator('.erp-stat-tile', { hasText: 'Ready to pay' }).click();
    await expect(row(page, state.alertPr!)).toBeVisible();
    problems.assertNone();
  });

  test('store keeper can request purchase for an in-stock material from the row menu', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await page.goto('/inventory?tab=stock');
    // This material already has an open requisition (the cancelled payment put it back to
    // Approved), so the menu offers "Request purchase" disabled, with the reason.
    const r = row(page, MAT_CODE).filter({ hasText: state.bin! });
    await expect(r).toContainText('In stock');
    await r.getByRole('button', { name: 'More actions' }).click();
    const item = page.getByRole('menuitem', { name: /Request purchase/ });
    await expect(item).toBeDisabled();
    await expect(page.getByText(/Already requested on PR-/)).toBeVisible();
    await page.keyboard.press('Escape');

    // A seeded in-stock material with no open requisition can be reordered ahead of an alert.
    const other = row(page, 'FAB-COT-002').first();
    await expect(other).toContainText('In stock');
    await rowMenu(other, 'Request purchase');
    const d = dialog(page, 'Request purchase');
    await d.getByLabel('Quantity to buy').fill('40');
    await d.getByRole('button', { name: 'Send for approval' }).click();
    await expectToast(page, /sent for approval/);
    problems.assertNone();
  });

  test('store keeper cancels a draft requisition', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await page.goto('/purchase');
    await page.getByRole('button', { name: 'New requisition' }).first().click();
    const d = dialog(page, 'New purchase requisition');
    await pickOption(d.getByLabel('Material'), 'FAB-LIN-001');
    await d.getByLabel('Quantity').fill('12');
    await d.getByRole('button', { name: 'Save as draft' }).click();
    await expectToast(page, /saved as draft/);
    const r = page.locator('tr.erp-row-selected');
    const prNo = (await r.locator('.erp-cell-primary').innerText()).trim();
    await rowMenu(r, 'Cancel requisition');
    await alertDialog(page).getByRole('button', { name: 'Cancel requisition' }).click();
    await expectToast(page, `${prNo} cancelled`);
    await expect(row(page, prNo)).toHaveCount(0);
    await page.getByLabel('Status').selectOption('CANCELLED');
    await expect(row(page, prNo)).toBeVisible();
    problems.assertNone();
  });
});
