import { test, expect, type Browser, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { api, apiLogin, expectToast, loginAs, uniq, type RoleKey } from './helpers';

/**
 * Product development flow, driven through the UI role by role:
 * design → review/revision → approve → release → pattern tech pack → sample → material request
 * → store issue → cutting/stitching → sample QC → fit → sample approval → SKUs → BOM → MRP.
 *
 * Run (local stack only):
 *   PLAYWRIGHT_BASE_URL=http://localhost:5321 E2E_API_URL=http://localhost:3321/api/v1 \
 *     npx playwright test e2e/develop-flow.spec.ts --workers=1
 */

type Actor = Awaited<ReturnType<typeof loginAs>>;

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const STYLE = uniq('E2E-STY');
const TITLE = `E2E linen shirt ${STYLE.slice(-5)}`;
const REVISION_NOTE = 'Please add a back view and confirm the collar shape';

const state: { designId?: string; designCode?: string; sampleId?: string; sampleCode?: string; skuCode?: string; bomId?: string } = {};
const actors: Partial<Record<RoleKey, Actor>> = {};

async function as(browser: Browser, request: APIRequestContext, role: RoleKey): Promise<Actor> {
  if (!actors[role]) actors[role] = await loginAs(browser, request, role);
  const a = actors[role]!;
  a.problems.clear();
  return a;
}

/** Open an ErpSearchSelect inside the field labelled `label` and pick the option matching `option`. */
async function pickInField(page: Page, scope: Locator | Page, label: string | RegExp, search: string, option: string | RegExp) {
  const labelRe = typeof label === 'string' ? new RegExp(`^${label}`) : label;
  const field = scope.locator('.erp-field').filter({ has: page.locator('label', { hasText: labelRe }) }).first();
  await field.locator('button[aria-haspopup="listbox"]').first().click();
  await page.getByLabel('Filter options').fill(search);
  await page.getByRole('option', { name: option }).first().click();
}

async function answerPrompt(page: Page, text: string, confirm: string | RegExp) {
  const dialog = page.getByRole('dialog').last();
  await dialog.locator('textarea').fill(text);
  await dialog.getByRole('button', { name: confirm }).click();
}

async function bellHas(page: Page, text: string | RegExp) {
  if (page.url() === 'about:blank') await page.goto('/');
  else await page.reload();
  await page.getByRole('button', { name: /^Notifications/ }).click();
  const item = page.locator('li button').filter({ hasText: text }).first();
  await expect(item).toBeVisible();
  await page.getByRole('button', { name: /^Notifications/ }).click();
}

test.describe.serial('Product development flow (UI)', () => {
  // Each step drives several roles through the real UI; give slow local stacks room.
  test.describe.configure({ timeout: 300_000 });

  test.afterEach(async ({}, info) => {
    if (info.status === info.expectedStatus) return;
    for (const [role, a] of Object.entries(actors)) {
      if (a?.problems.items.length) console.log(`[${role}] problems:\n  ${a.problems.items.join('\n  ')}`);
      if (a) console.log(`[${role}] url: ${a.page.url()}`);
    }
  });

  test.afterAll(async () => {
    for (const a of Object.values(actors)) await a?.context.close();
  });

  test('designer creates a design draft and submits it', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'designer');
    await page.goto('/designs');
    await expect(page.getByRole('heading', { name: /My designs|Design library/ })).toBeVisible();

    // Ctrl+K palette offers "New design"
    await page.keyboard.press('Control+k');
    const palette = page.getByLabel('Command palette');
    await expect(palette).toBeVisible();
    await page.getByPlaceholder('Search pages and actions…').fill('New design');
    await palette.getByText('New design', { exact: true }).first().click();
    await expect(page).toHaveURL(/\/designs\/new$/);
    await expect(page.getByRole('heading', { name: 'New design' })).toBeVisible();

    // Basics
    await page.getByPlaceholder('e.g. Linen camp-collar shirt').fill(TITLE);
    await page.getByPlaceholder('STY-001').fill(STYLE);
    await pickInField(page, page, 'Collection', 'SS26', /SS26/);
    await page.getByPlaceholder('Design intent, references, key details…').fill('E2E: relaxed camp-collar linen shirt.');
    await pickInField(page, page, 'Category', 'TW-SH', /TW-SH — Shirt/);
    await pickInField(page, page, 'Gender', 'MEN', /^MEN — Men/);
    await pickInField(page, page, 'Fit', 'RF', /^RF — Regular Fit/);

    // Save draft first
    await page.getByRole('button', { name: 'Create draft' }).click();
    await expectToast(page, 'Design created');
    await expect(page).toHaveURL(/\/designs\/[a-f0-9]{24}\/edit/);
    state.designId = page.url().match(/designs\/([a-f0-9]{24})/)![1];

    // Colourways
    const nav = page.getByRole('navigation', { name: 'Tech pack sections' }).last();
    await nav.getByRole('button', { name: /Colourways/ }).click();
    await pickInField(page, page, 'Colour 1', 'NAVBLU', /NAVBLU — Navy Blue/);
    await page.getByRole('button', { name: 'Add colour', exact: true }).click();
    await pickInField(page, page, 'Colour 2', 'WHT', /^WHT — White/);

    // Sizes
    await nav.getByRole('button', { name: /Sizes & SKUs/ }).click();
    const sizes = page.locator('.erp-field').filter({ has: page.locator('label', { hasText: /^Sizes/ }) });
    for (const s of ['S', 'M', 'L']) await sizes.getByRole('button', { name: s, exact: true }).click();

    // Images: front image required for submit
    await nav.getByRole('button', { name: /Images/ }).click();
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await expect(page.getByText('Not saved yet').first()).toBeVisible();

    await page.getByRole('button', { name: 'Save draft' }).click();
    await expectToast(page, 'Draft saved');
    await expect(page.getByText('All changes saved')).toBeVisible();

    // SKU preview populated after save
    await nav.getByRole('button', { name: /Sizes & SKUs/ }).click();
    await expect(page.getByRole('cell', { name: /Navy Blue/ })).toBeVisible();

    const d = await api(request, await apiLogin(request, 'designer')).get(`/designs/${state.designId}`);
    state.designCode = d.designCode;
    expect(d.colorVariants.length).toBe(2);
    expect(d.sizeChartData.sizeLabels).toEqual(['S', 'M', 'L']);

    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expectToast(page, 'Submitted for review');
    await expect(page).toHaveURL(/\/designs$/);
    problems.assertNone();
  });

  test('design manager requests a revision from the approvals inbox', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'designManager');
    await bellHas(page, new RegExp(state.designCode!));
    await page.goto('/approvals');
    const row = page.locator('li').filter({ hasText: TITLE }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Request changes' }).click();
    await answerPrompt(page, REVISION_NOTE, 'Send back');
    await expectToast(page, /sent back for changes/);
    await expect(row).toHaveCount(0);
    problems.assertNone();
  });

  test('designer sees feedback, edits and resubmits', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'designer');
    await bellHas(page, new RegExp(state.designCode!));
    await page.goto('/designs');
    const row = page.locator('tr').filter({ hasText: state.designCode! });
    await expect(row.getByText(REVISION_NOTE)).toBeVisible();
    await row.getByRole('button', { name: 'Revise' }).click();
    await expect(page.getByText(REVISION_NOTE)).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Tech pack sections' }).last();
    await nav.getByRole('button', { name: /Images/ }).click();
    await page.locator('input[type="file"]').nth(2).setInputFiles({ name: 'back.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await nav.getByRole('button', { name: /Basic details/ }).click();
    await page.getByPlaceholder('Design intent, references, key details…').fill('E2E: camp collar confirmed; back view added.');
    await page.getByRole('button', { name: 'Resubmit for review' }).click();
    await expectToast(page, 'Submitted for review');
    problems.assertNone();
  });

  test('design manager approves; admin releases to the pattern master', async ({ browser, request }) => {
    const mgr = await as(browser, request, 'designManager');
    await mgr.page.goto('/designs');
    // gallery / table toggle + search
    await mgr.page.getByLabel('Gallery view').click();
    await expect(mgr.page.getByRole('button', { name: new RegExp(TITLE) })).toBeVisible();
    await mgr.page.getByLabel('Table view').click();
    await mgr.page.getByPlaceholder('Search title, code or style #…').fill(STYLE);
    const row = mgr.page.locator('tr').filter({ hasText: state.designCode! });
    await expect(row).toBeVisible();
    await expect(mgr.page.locator('tbody tr')).toHaveCount(1);
    await row.click();
    await expect(mgr.page.getByRole('heading', { name: TITLE })).toBeVisible();
    await mgr.page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: 'Approve' }).click();
    await expectToast(mgr.page, 'Design approved');
    mgr.problems.assertNone();

    const admin = await as(browser, request, 'admin');
    await admin.page.goto(`/designs/${state.designId}/edit`);
    await admin.page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: 'Release to pattern' }).click();
    const dlg = admin.page.getByRole('dialog', { name: 'Release to pattern' });
    await dlg.getByLabel('Pattern master').click();
    await admin.page.getByLabel('Filter options').fill('pattern@demo.local');
    await admin.page.getByRole('option', { name: /pattern@demo\.local/ }).click();
    await dlg.getByRole('button', { name: 'Release and assign' }).click();
    await expectToast(admin.page, 'Design released to pattern');
    await expect(admin.page.getByText(/Released as v/)).toBeVisible();
    // lifecycle moved on: Pattern is the current step
    await expect(admin.page.getByText('Approved — release next')).toHaveCount(0);
    admin.problems.assertNone();
  });

  test('pattern master fills the tech pack, marker, base size and completes', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'pattern');
    await bellHas(page, new RegExp(`${state.designCode}|${TITLE}`));
    await page.goto('/pattern');
    await expect(page.getByRole('heading', { name: 'Pattern development' })).toBeVisible();
    const row = page.locator('tr').filter({ hasText: TITLE });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(TITLE) })).toBeVisible();

    // Measurements (size range comes from the design)
    for (const [code, name] of [['CHEST', 'Chest'], ['LENGTH', 'Length']] as const) {
      await pickInField(page, page, 'Add point of measure', code, new RegExp(`^${code} — ${name}`));
      await expect(page.getByLabel(`${name} S`, { exact: true })).toBeVisible();
    }
    const vals: Record<string, number[]> = { Chest: [96, 101, 106], Length: [72, 74, 76] };
    for (const [name, nums] of Object.entries(vals)) {
      for (const [i, s] of ['S', 'M', 'L'].entries()) await page.getByLabel(`${name} ${s}`, { exact: true }).fill(String(nums[i]));
    }

    // Fabric consumption with a real store fabric
    const fabric = page.locator('#techpack-fabric');
    if (!(await fabric.getByRole('button', { name: /Select fabric/ }).count())) {
      await fabric.getByRole('button', { name: 'Add fabric', exact: true }).click();
    }
    await fabric.getByRole('button', { name: /Select fabric/ }).first().click();
    await page.getByLabel('Filter options').fill('FAB-LIN-001');
    await page.getByRole('option', { name: /FAB-LIN-001/ }).click();
    await fabric.getByLabel('Metres per piece').first().fill('1.6');

    // Trims
    const trims = page.locator('#techpack-trims');
    await trims.getByRole('button', { name: 'Add trim', exact: true }).click();
    await trims.getByRole('button', { name: /Select material/ }).first().click();
    await page.getByLabel('Filter options').fill('BTN-001');
    await page.getByRole('option', { name: /BTN-001/ }).click();
    await trims.getByLabel('Quantity per piece').first().fill('8');

    await page.getByRole('button', { name: 'Save tech pack' }).click();
    await expectToast(page, 'Tech pack saved');
    // The workspace advances to the marker step by itself once the tech pack is complete.
    await expect(page.getByLabel('Marker length (m)')).toBeVisible();

    // Marker
    await page.getByLabel('Marker length (m)').fill('3.2');
    await page.getByLabel('Pieces per marker').fill('2');
    await page.getByLabel('Wastage allowance %').fill('5');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expectToast(page, 'Marker and consumption saved');

    // Base size
    await pickInField(page, page, 'Base size', 'M', /^M — M$/);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expectToast(page, 'Base size saved');

    // Sign-off
    const boxes = page.locator('input[type="checkbox"]');
    await expect(boxes).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      await expect(boxes.nth(i)).toBeEnabled();
      await boxes.nth(i).check();
    }
    await page.getByRole('button', { name: 'Complete pattern' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Complete' }).click();
    await expectToast(page, 'Pattern development complete');
    await expect(page).toHaveURL(/\/samples\?designId=/);
    problems.assertNone();
  });

  test('sampling team creates a fit sample from the New sample drawer', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'sampling');
    await page.goto('/samples');
    await expect(page.getByRole('heading', { name: 'Sampling' })).toBeVisible();
    await page.getByRole('button', { name: 'New sample' }).first().click();
    const drawer = page.getByRole('dialog', { name: 'New sample' });
    await drawer.getByLabel('Design').click();
    await page.getByLabel('Filter options').fill(STYLE.slice(-5));
    await page.getByRole('option', { name: new RegExp(TITLE) }).click();
    await drawer.getByLabel('Sample type').selectOption('FIT');
    await drawer.getByRole('button', { name: 'Create and open' }).click();
    await expectToast(page, 'Sample created');
    await expect(page).toHaveURL(/sampleId=([a-f0-9]{24})/);
    state.sampleId = page.url().match(/sampleId=([a-f0-9]{24})/)![1];
    const s = await api(request, await apiLogin(request, 'sampling')).get(`/samples/${state.sampleId}`);
    state.sampleCode = s.sampleCode;
    expect(s.status).toBe('CREATED');
    problems.assertNone();
  });

  async function confirmAction(page: Page, label: string) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: label, exact: true }).click();
  }

  async function openSample(page: Page) {
    await page.goto('/samples');
    const row = page.locator('tr').filter({ hasText: state.sampleCode! });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByRole('heading', { name: new RegExp(state.sampleCode!) })).toBeVisible();
  }

  test('pattern master loads materials from the tech pack and submits the material request', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'pattern');
    await openSample(page);
    await page.getByRole('button', { name: 'Load from tech pack' }).first().click();
    await expectToast(page, 'Materials loaded from the pattern tech pack');
    await expect(page.getByLabel('Required quantity')).toHaveCount(2);
    await confirmAction(page, 'Submit materials for approval');
    await expectToast(page, 'Materials submitted for approval');
    problems.assertNone();
  });

  test('approver requests material changes, pattern master resubmits, approver approves in the inbox', async ({ browser, request }) => {
    const mgr = await as(browser, request, 'designManager');
    await openSample(mgr.page);
    await mgr.page.getByRole('button', { name: 'Request changes', exact: true }).first().click();
    await answerPrompt(mgr.page, 'Use 2 m of linen to allow for a shrinkage test', 'Request changes');
    await expectToast(mgr.page, 'Changes requested');
    mgr.problems.assertNone();

    const pm = await as(browser, request, 'pattern');
    await bellHas(pm.page, new RegExp(state.sampleCode!));
    await openSample(pm.page);
    await expect(pm.page.getByText('Use 2 m of linen to allow for a shrinkage test').first()).toBeVisible();
    // REVISION_REQUESTED → reopen first when offered, then edit
    const reopen = pm.page.getByRole('button', { name: 'Reopen for rework', exact: true });
    if (await reopen.count()) {
      await confirmAction(pm.page, 'Reopen for rework');
      await expectToast(pm.page, 'Sample reopened for rework');
    }
    await pm.page.getByLabel('Required quantity').first().fill('2');
    await pm.page.getByRole('button', { name: 'Save materials' }).click();
    await expectToast(pm.page, 'Materials and labour saved');
    await confirmAction(pm.page, 'Submit materials for approval');
    await expectToast(pm.page, 'Materials submitted for approval');
    pm.problems.assertNone();

    mgr.problems.clear();
    await mgr.page.goto('/approvals');
    const row = mgr.page.locator('li').filter({ hasText: state.sampleCode! }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /^Approve/ }).click();
    await mgr.page.getByRole('dialog').last().getByRole('button', { name: 'Approve', exact: true }).click();
    await expectToast(mgr.page, /approved/);
    const s = await api(request, await apiLogin(request, 'designManager')).get(`/samples/${state.sampleId}`);
    expect(s.status).toBe('MATERIAL_REQUEST_APPROVED');
    mgr.problems.assertNone();
  });

  test('store keeper reserves and issues the materials', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    await openSample(page);
    await confirmAction(page, 'Reserve stock');
    await expectToast(page, 'Stock reserved');
    await confirmAction(page, 'Issue to cutting');
    await expectToast(page, 'Materials issued');
    problems.assertNone([/Not enough stock/]);
  });

  test('sampling team completes cutting and stitching', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'sampling');
    await openSample(page);
    await confirmAction(page, 'Mark cutting complete');
    await expectToast(page, 'Cutting complete');
    await confirmAction(page, 'Mark stitching complete');
    await expectToast(page, 'Stitching complete');
    problems.assertNone();
  });

  test('QC inspector passes the sample on the Quality page', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'qc');
    await bellHas(page, new RegExp(state.sampleCode!));
    await page.goto('/quality');
    await page.getByRole('tab', { name: /Samples/ }).click();
    const row = page.locator('tr').filter({ hasText: state.sampleCode! });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Inspect' }).click();
    const drawer = page.getByRole('dialog').last();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Complete inspection' }).click();
    const sure = page.getByRole('alertdialog');
    if (await sure.isVisible().catch(() => false) || await sure.waitFor({ timeout: 2000 }).then(() => true, () => false)) {
      await sure.getByRole('button', { name: 'Complete inspection' }).click();
    }
    await expectToast(page, 'Sample QC passed');
    problems.assertNone();
  });

  test('sampling team records the fit session; approver approves the sample', async ({ browser, request }) => {
    const sm = await as(browser, request, 'sampling');
    await openSample(sm.page);
    await sm.page.getByRole('button', { name: 'Record fit session', exact: true }).first().click();
    const dlg = sm.page.getByRole('dialog', { name: 'Record fit session' });
    await dlg.getByLabel('Evaluated on').selectOption({ index: 1 });
    await dlg.getByLabel('Overall result').selectOption({ index: 1 });
    await dlg.getByLabel('Fit notes').fill('Good fit on the size M model.');
    await dlg.getByRole('button', { name: 'Record fit session' }).click();
    await expectToast(sm.page, 'Fit session recorded');
    sm.problems.assertNone();

    const mgr = await as(browser, request, 'designManager');
    await openSample(mgr.page);
    await confirmAction(mgr.page, 'Approve sample');
    await expectToast(mgr.page, 'Sample approved');
    const s = await api(request, await apiLogin(request, 'designManager')).get(`/samples/${state.sampleId}`);
    expect(s.status).toBe('APPROVED');
    mgr.problems.assertNone();
  });

  test('design manager generates SKUs from the approved sample (preview, then create)', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'designManager');
    await page.goto('/products/skus');
    await page.getByRole('button', { name: 'Generate SKUs' }).first().click();
    const drawer = page.getByRole('dialog', { name: 'Generate SKUs' });
    await drawer.getByLabel('Approved sample').click();
    await page.getByLabel('Filter options').fill(state.sampleCode!);
    await page.getByRole('option', { name: new RegExp(state.sampleCode!) }).click();
    const preview = drawer.locator('tbody tr');
    await expect(preview).toHaveCount(6); // 2 colours × 3 sizes
    state.skuCode = (await preview.first().locator('td').first().innerText()).trim();
    await drawer.getByRole('button', { name: 'Generate 6 SKUs' }).click();
    await expectToast(page, 'Created 6 SKUs');
    await expect(drawer).toBeHidden();
    await expect(page.getByText(state.skuCode).first()).toBeVisible();
    problems.assertNone();
  });

  test('planner creates a BOM for one SKU and submits it; admin approves in the inbox', async ({ browser, request }) => {
    const pl = await as(browser, request, 'planner');
    await pl.page.goto('/products/boms');
    await pl.page.getByRole('button', { name: 'New BOM' }).first().click();
    const drawer = pl.page.getByRole('dialog', { name: 'New BOM' });
    await drawer.getByLabel('SKU').click();
    await pl.page.getByLabel('Filter options').fill(state.skuCode!);
    await pl.page.getByRole('option', { name: new RegExp(state.skuCode!) }).click();
    await expect(drawer.getByText('Lines that will be added')).toBeVisible();
    await expect(drawer.getByText(/FAB-LIN-001|Linen Blend/).first()).toBeVisible();
    await drawer.getByRole('button', { name: 'Create BOM' }).click();
    await expectToast(pl.page, 'BOM created');
    const detail = pl.page.getByRole('dialog').filter({ hasText: /BOM-/ }).last();
    await detail.getByRole('button', { name: 'Submit for approval' }).click();
    await expectToast(pl.page, 'BOM submitted for approval');
    const boms = await api(request, await apiLogin(request, 'planner')).get('/boms', { search: state.skuCode! });
    const bom = (Array.isArray(boms) ? boms : boms.items)[0];
    state.bomId = bom._id;
    expect(bom.status).toBe('PENDING_APPROVAL');
    pl.problems.assertNone();

    const admin = await as(browser, request, 'admin');
    await bellHas(admin.page, new RegExp(bom.bomCode));
    await admin.page.goto('/approvals');
    const row = admin.page.locator('li').filter({ hasText: bom.bomCode }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /^Approve/ }).click();
    await admin.page.getByRole('dialog').last().getByRole('button', { name: 'Approve', exact: true }).click();
    await expectToast(admin.page, /approved/);
    admin.problems.assertNone();

    // Planner freezes it and runs MRP
    pl.problems.clear();
    await pl.page.goto('/products/boms');
    await pl.page.getByRole('button', { name: /Ready to freeze/ }).click();
    const bomRow = pl.page.locator('tr').filter({ hasText: bom.bomCode });
    await expect(bomRow).toBeVisible();
    await bomRow.getByRole('button', { name: 'Freeze' }).click();
    await pl.page.getByRole('alertdialog').getByRole('button', { name: 'Freeze and run MRP' }).click();
    await expectToast(pl.page, 'BOM frozen as standard cost');
    await expect(pl.page.getByRole('dialog', { name: new RegExp(`MRP preview — ${bom.bomCode}`) })).toBeVisible();
    pl.problems.assertNone();
  });

  test('design lifecycle shows the whole chain as done', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'designManager');
    await page.goto(`/designs/${state.designId}/edit`);
    await expect(page.getByText(/^Released v\d+$/).first()).toBeVisible();
    await expect(page.getByText('Completed', { exact: true })).toBeVisible(); // pattern
    await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible(); // sample
    await expect(page.getByText('BOM frozen', { exact: true })).toBeVisible(); // SKU / BOM
    await expect(page.getByText('Plan orders', { exact: true })).toBeVisible(); // production next
    problems.assertNone();
  });
});
