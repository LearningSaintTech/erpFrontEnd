import { test, expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import {
  API_URL, api, apiLogin, apiLoginAs, apiLoginWith, expectToast, loginWithRefreshCookie,
  uniq, type RoleKey,
} from './helpers';

/**
 * Approvals & access control, driven through the UI as real roles:
 *  1. Two-level PR approval (L1 Factory Admin → L2 general approval authority held by another user)
 *  2. Delegated approval (lend purchase.authorize for 7 days, approve, revoke)
 *  3. Super admin: new organization + second factory; factory switching isolates data
 *  4. Silent token refresh (needs a backend started with JWT_ACCESS_EXPIRY=20s) + lock → /login
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:5331 E2E_API_URL=http://localhost:3331/api/v1 \
 *     npx playwright test e2e/approvals-access.spec.ts --workers=1
 *
 * Flow 4 skips itself unless the backend issues short-lived (<= 60s) access tokens.
 */

type Actor = Awaited<ReturnType<typeof loginWithRefreshCookie>>;

const dialog = (page: Page, name: string | RegExp) =>
  page.locator('[role="dialog"], [role="alertdialog"]').filter({ has: page.getByText(name, { exact: false }) }).last();

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

/** ErpSearchSelect: open the trigger, type, pick the option. */
async function pickOption(trigger: Locator, text: string) {
  await trigger.click();
  const panel = trigger.page().locator('[data-erp-search-panel="true"]');
  await panel.getByLabel('Filter options').fill(text);
  await panel.getByRole('option', { name: new RegExp(text) }).first().click();
  await expect(panel).toHaveCount(0);
}

const prRow = (page: Page, pr: string) => page.getByRole('row').filter({ hasText: pr });
const inboxItem = (page: Page, code: string) =>
  page.locator('li').filter({ has: page.getByRole('button', { name: code, exact: true }) });

/** Store keeper (or anyone with purchase.create) raises + submits a 1-line PR through the UI. */
async function createAndSubmitPr(page: Page, material = 'BTN-001', qty = '40') {
  await page.goto('/purchase');
  await settle(page);
  await page.getByRole('button', { name: 'New requisition' }).first().click();
  const d = page.getByRole('dialog', { name: 'New purchase requisition' });
  await pickOption(d.getByLabel('Material').first(), material);
  await d.getByLabel('Quantity').first().fill(qty);
  await d.getByRole('button', { name: /Create & submit/ }).click();
  const toastEl = page.locator('[role="status"], [role="alert"]').filter({ hasText: /PR-\S+ sent for approval/ }).first();
  await expect(toastEl).toBeVisible();
  const pr = (await toastEl.innerText()).match(/(PR-\S+) sent for approval/)![1];
  await expect(d).toHaveCount(0);
  return pr;
}

async function notificationsFor(request: APIRequestContext, role: RoleKey) {
  const s = await apiLogin(request, role);
  const data = await api(request, s).get('/notifications', { limit: 100 });
  return ((data.items ?? data) as Array<{ eventType: string; title: string; message: string; referenceId?: string }>);
}

async function prByNumber(request: APIRequestContext, prNumber: string) {
  const s = await apiLogin(request, 'admin');
  const data = await api(request, s).get('/purchase-requisitions', { limit: 100, search: prNumber });
  const items = (data.items ?? data) as Array<{ _id: string; prNumber: string; status: string }>;
  const pr = items.find((p) => p.prNumber === prNumber);
  expect(pr, `PR ${prNumber} found`).toBeTruthy();
  return pr!;
}

/**
 * One browser context per role, reused across a serial flow (`fresh` re-signs in, e.g. to pick up
 * new permissions). Browser contexts carry the refresh cookie, so they survive short access-token
 * lifetimes; the `session` used for API assertions is re-issued on every call for the same reason.
 */
function actorPool() {
  const actors: Partial<Record<RoleKey, Actor>> = {};
  const as = async (browser: Browser, request: APIRequestContext, role: RoleKey, fresh = false) => {
    if (fresh && actors[role]) { await actors[role]!.context.close(); delete actors[role]; }
    if (!actors[role]) actors[role] = await loginWithRefreshCookie(browser, role);
    const a = actors[role]!;
    const s = await apiLogin(request, role);
    a.session.accessToken = s.accessToken;
    a.problems.clear();
    return a;
  };
  const closeAll = async () => { for (const a of Object.values(actors)) await a?.context.close(); };
  return { as, closeAll };
}

// ───────────────────────────── 1. Two-level approval ─────────────────────────────

test.describe.serial('Multi-level PR approval (2 levels, clicked through the UI)', () => {
  const { as, closeAll } = actorPool();
  const wfName = uniq('E2E PR L1 admin L2 general');
  let pr = '';

  test.afterAll(async ({ request }) => {
    await closeAll();
    // If the flow stopped midway, don't leave the 2-level workflow active for the next flows.
    const admin = api(request, await apiLogin(request, 'admin'));
    const wfs = (await admin.get('/approval-workflows')) as Array<{ _id: string; name: string }>;
    const left = wfs.find((w) => w.name === wfName);
    if (left) await admin.post(`/approval-workflows/${left._id}/deactivate`);
  });

  test('admin creates a 2-level PURCHASE_REQUISITION workflow (L1 purchase.authorize, L2 approval.approve)', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'admin');
    await page.goto('/approvals?tab=workflows');
    await settle(page);
    await page.getByRole('button', { name: 'New workflow' }).first().click();
    const d = dialog(page, 'New approval workflow');
    await d.getByLabel('Document type').selectOption('PURCHASE_REQUISITION');
    await d.getByLabel('Workflow name').fill(wfName);
    await d.getByRole('button', { name: 'Add level' }).click();
    const who = d.getByLabel('Who approves');
    await expect(who).toHaveCount(2);
    // What the UI offers for a PR level: the document's own approver + general approval authority.
    const offered = await who.nth(0).locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(offered).toEqual(expect.arrayContaining(['purchase.authorize', 'approval.approve']));
    await who.nth(0).selectOption('purchase.authorize');
    await who.nth(1).selectOption('approval.approve');
    await d.getByRole('button', { name: 'Create workflow' }).click();
    await expectToast(page, 'Workflow created');
    const wfRow = page.locator('tbody tr').filter({ hasText: wfName });
    await expect(wfRow).toContainText('L1: Factory Admin / Super Admin');
    await expect(wfRow).toContainText('L2: General approval authority');
    const wfs = (await api(request, await apiLogin(request, 'admin')).get('/approval-workflows')) as Array<{ name: string; documentType: string; levels: Array<{ approverRoles: string[] }> }>;
    const prWfs = wfs.filter((w) => w.documentType === 'PURCHASE_REQUISITION');
    expect(prWfs.map((w) => w.name), 'the new workflow replaced the previous active PR workflow').toEqual([wfName]);
    expect(prWfs[0].levels.map((l) => l.approverRoles)).toEqual([['purchase.authorize'], ['approval.approve']]);
    problems.assertNone();
  });

  test('store keeper creates and submits a requisition', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'store');
    pr = await createAndSubmitPr(page);
    await expect(prRow(page, pr)).toContainText('Level 1 of 2');
    problems.assertNone();
  });

  test('level 1 (factory admin) approves in the inbox → stays pending at Level 2 of 2', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'admin');
    await page.goto('/approvals');
    await settle(page);
    const item = inboxItem(page, pr);
    await expect(item).toContainText('Level 1 of 2');
    await item.getByRole('button', { name: 'Approve', exact: true }).click();
    const ap = dialog(page, `Approve ${pr}?`);
    await ap.getByRole('textbox').fill('L1 ok');
    await ap.getByRole('button', { name: 'Approve', exact: true }).click();
    await expectToast(page, `${pr} approved`);
    // Still pending, now at level 2 — and the L1 approver can no longer act on it.
    await expect(item).toContainText('Level 2 of 2');
    await expect(item.getByRole('button', { name: /^Approve/ })).toHaveCount(0);
    await expect(item).toContainText(/approved level 1|another approver/i);

    expect((await prByNumber(request, pr)).status, 'not approved after level 1').toBe('SUBMITTED');
    // Submitter is not told "approved" yet.
    const notes = await notificationsFor(request, 'store');
    expect(notes.filter((n) => n.eventType === 'pr.approved' && n.message.includes(pr))).toHaveLength(0);
    problems.assertNone();
  });

  test('direct Approve on the Purchase page is blocked while level 2 remains (UI + API)', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'admin');
    await page.goto('/purchase');
    await settle(page);
    const r = prRow(page, pr);
    await expect(r).toContainText('Level 2 of 2');
    await expect(r.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(r).toContainText('You approved level 1 — a different approver must decide level 2');
    // Calling the direct endpoint anyway is refused with a clear message.
    const session = await apiLogin(request, 'admin');
    const res = await request.post(`${API_URL}/purchase-requisitions/${(await prByNumber(request, pr))._id}/approve`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, 'X-Factory-Id': session.factoryId },
    });
    const body = await res.json();
    expect(body.success).toBeFalsy();
    expect(res.status()).toBe(403);
    expect(body.error.message).toMatch(/level 1.*different approver.*level 2/i);
    expect((await prByNumber(request, pr)).status).toBe('SUBMITTED');
    problems.assertNone();
  });

  test('level 2 approver (production manager, holds approval.approve) approves → Approved; submitter notified', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'productionManager');
    // Notified that a level-2 decision waits for them.
    const notes = await notificationsFor(request, 'productionManager');
    expect(notes.some((n) => /Purchase requisition awaiting approval/.test(n.title) && /level 2/.test(n.message))).toBeTruthy();
    await page.goto('/approvals');
    await settle(page);
    const item = inboxItem(page, pr);
    await expect(item).toContainText('Level 2 of 2');
    await item.getByRole('button', { name: 'Approve L2' }).click();
    await dialog(page, `Approve ${pr}?`).getByRole('button', { name: 'Approve', exact: true }).click();
    await expectToast(page, `${pr} approved`);
    await expect(item).toHaveCount(0);
    problems.assertNone();

    expect((await prByNumber(request, pr)).status).toBe('APPROVED');
    const storeNotes = await notificationsFor(request, 'store');
    expect(storeNotes.filter((n) => n.eventType === 'pr.approved' && n.message.includes(pr))).toHaveLength(1);
  });

  test('store keeper sees the PR as Approved; admin deactivates the workflow (cleanup)', async ({ browser, request }) => {
    const s = await as(browser, request, 'store');
    await s.page.goto('/purchase');
    await settle(s.page);
    await expect(prRow(s.page, pr)).toContainText('Ready for payment');
    s.problems.assertNone();

    const { page, problems } = await as(browser, request, 'admin');
    await page.goto('/approvals?tab=workflows');
    await settle(page);
    const wfRow = page.locator('tbody tr').filter({ hasText: wfName });
    await wfRow.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Deactivate' }).click();
    await dialog(page, `Deactivate "${wfName}"?`).getByRole('button', { name: 'Deactivate' }).click();
    await expectToast(page, 'Workflow deactivated');
    await expect(page.locator('tbody tr').filter({ hasText: wfName })).toHaveCount(0);
    const wfs = (await api(request, await apiLogin(request, 'admin')).get('/approval-workflows')) as Array<{ name: string }>;
    expect(wfs.find((w) => w.name === wfName)).toBeFalsy();
    problems.assertNone();
  });
});

// ───────────────────────────── 2. Delegated approval ─────────────────────────────

test.describe.serial('Delegated approval (purchase.authorize lent to the purchase manager)', () => {
  const { as, closeAll } = actorPool();
  let pr1 = '';
  let pr2 = '';

  test.afterAll(async ({ request }) => {
    await closeAll();
    // If the flow stopped midway, revoke what it lent so later flows/runs start clean.
    const adminS = await apiLogin(request, 'admin');
    const pmId = (await apiLogin(request, 'purchase')).userId;
    const admin = api(request, adminS);
    const ds = (await admin.get('/delegations')) as Array<{ _id: string; status?: string; delegateId: string | { _id: string } }>;
    for (const d of ds) {
      const to = typeof d.delegateId === 'object' ? d.delegateId._id : d.delegateId;
      if (to === pmId && (d.status ?? 'ACTIVE') === 'ACTIVE') await admin.post(`/delegations/${d._id}/revoke`);
    }
  });

  test('before: the purchase manager cannot approve requisitions', async ({ browser, request }) => {
    const store = await as(browser, request, 'store');
    pr1 = await createAndSubmitPr(store.page, 'BTN-001', '25');
    store.problems.assertNone();

    const { page, problems } = await as(browser, request, 'purchase');
    await page.goto('/approvals');
    await settle(page);
    const item = inboxItem(page, pr1);
    await expect(item).toBeVisible();
    await expect(item.getByRole('button', { name: /^Approve/ })).toHaveCount(0);
    await expect(item).toContainText('Waiting for Factory Admin / Super Admin');
    problems.assertNone();
  });

  test('admin delegates "Purchase · authorize" to the purchase manager for 7 days', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'admin');
    await page.goto('/users?tab=delegations');
    await settle(page);
    await page.getByRole('button', { name: 'New delegation' }).first().click();
    const d = dialog(page, 'New delegation');
    const opts = await d.getByLabel('Delegate to').locator('option').allTextContents();
    const target = opts.find((o) => /Purchase Manager/.test(o));
    expect(target, `delegate option in ${opts.join(' | ')}`).toBeTruthy();
    await d.getByLabel('Delegate to').selectOption({ label: target! });
    const start = await d.getByLabel('Starts').inputValue();
    const end = await d.getByLabel('Ends').inputValue();
    expect(Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)).toBe(7);
    await d.locator('button[title="purchase.authorize"]').click();
    await expect(d.locator('button[title="purchase.authorize"]')).toHaveAttribute('aria-checked', 'true');
    await d.getByRole('button', { name: 'Create delegation' }).click();
    await expectToast(page, 'Delegation created');
    await expect(page.locator('tbody tr').filter({ hasText: target! }).first()).toBeVisible();
    problems.assertNone();
  });

  test('delegate now sees Approve in the inbox and approves the requisition', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'purchase', true);
    await page.goto('/approvals');
    await settle(page);
    const item = inboxItem(page, pr1);
    await item.getByRole('button', { name: 'Approve', exact: true }).click();
    await dialog(page, `Approve ${pr1}?`).getByRole('button', { name: 'Approve', exact: true }).click();
    await expectToast(page, `${pr1} approved`);
    await expect(item).toHaveCount(0);
    expect((await prByNumber(request, pr1)).status).toBe('APPROVED');
    problems.assertNone();
  });

  test('admin revokes the delegation → the delegate is no longer offered Approve on a new item', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'admin');
    await page.goto('/users?tab=delegations');
    await settle(page);
    const row = page.locator('tbody tr').filter({ hasText: 'Purchase Manager' }).first();
    await row.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Revoke' }).click();
    await dialog(page, /Revoke/).getByRole('button', { name: /Revoke/ }).last().click();
    await expectToast(page, /revoked/i);
    problems.assertNone();

    const store = await as(browser, request, 'store');
    pr2 = await createAndSubmitPr(store.page, 'BTN-001', '15');

    const pm = await as(browser, request, 'purchase', true);
    await pm.page.goto('/approvals');
    await settle(pm.page);
    const item = inboxItem(pm.page, pr2);
    await expect(item).toBeVisible();
    await expect(item.getByRole('button', { name: /^Approve/ })).toHaveCount(0);
    await expect(item).toContainText('Waiting for Factory Admin / Super Admin');
    // And the server refuses too.
    const pmS = await apiLogin(request, 'purchase');
    const pending = await api(request, pmS).get('/approvals/pending', { limit: 100 });
    const inst = ((pending.items ?? pending) as Array<{ _id: string; documentSummary?: { code?: string } }>).find((i) => i.documentSummary?.code === pr2)!;
    const res = await request.post(`${API_URL}/approvals/${inst._id}/approve`, {
      headers: { Authorization: `Bearer ${pmS.accessToken}`, 'X-Factory-Id': pmS.factoryId },
      data: {},
    });
    expect(res.status()).toBe(403);
    pm.problems.assertNone();
  });
});

// ───────────────────────────── 3. Super admin + factory switching ─────────────────────────────

test.describe.serial('Super admin: new organization + second factory; factory switching isolates data', () => {
  const { as, closeAll } = actorPool();
  const tag = Date.now().toString(36).slice(-5).toUpperCase();
  const ORG_CODE = `QA${tag}`;
  const ORG_NAME = `QA Org ${tag}`;
  const F2_CODE = `F2${tag.slice(-4)}`;
  const F2_NAME = `QA Second Unit ${tag}`;
  const MAT2 = `F2MAT-${tag}`;
  const state: { f1?: string; f2?: string; f2Pr?: string; f1Prs: string[]; f1Orders: string[]; f1Materials: string[] } = {
    f1Prs: [], f1Orders: [], f1Materials: [],
  };

  test.afterAll(async () => {
    await closeAll();
  });

  test('super admin creates a new organization from Super Admin → Organizations', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'superAdmin');
    await page.goto('/');
    await page.locator('aside[aria-label="Sidebar"]').getByRole('link', { name: 'Organizations' }).click();
    await expect(page).toHaveURL(/\/admin\/organizations$/);
    await settle(page);
    await page.getByRole('button', { name: 'New organization' }).click();
    const d = dialog(page, 'New organization');
    await d.getByRole('button', { name: 'Create organization' }).click();
    await expect(d.getByText('Enter the company name.')).toBeVisible();
    await d.getByLabel('Organization name').fill(ORG_NAME);
    await d.getByLabel('Code').fill(ORG_CODE);
    await d.getByRole('button', { name: 'Create organization' }).click();
    await expectToast(page, 'Organization created');
    // Lands on the new org: no factories yet.
    const od = page.getByRole('dialog', { name: ORG_NAME });
    await expect(od).toBeVisible();
    await expect(od).toContainText('No factories yet');
    await od.getByRole('button', { name: 'Close' }).last().click();
    await expect(page.locator('tbody tr').filter({ hasText: ORG_CODE })).toBeVisible();
    problems.assertNone();
  });

  test('super admin adds a second factory to the demo organization', async ({ browser, request }) => {
    const { page, session, problems } = await as(browser, request, 'superAdmin');
    const admin = await apiLogin(request, 'admin');
    state.f1 = admin.factoryId;
    const me = await api(request, admin).get('/users/me');
    const orgs = (await api(request, session).get('/organizations')) as Array<{ _id: string; name: string; code: string }>;
    const demo = orgs.find((o) => o._id === me.user.organizationId)!;
    await page.goto('/admin/organizations');
    await settle(page);
    await page.locator('tbody tr').filter({ hasText: demo.code }).first().click();
    const od = page.getByRole('dialog', { name: demo.name });
    await expect(od).toContainText('F01');
    const form = od.getByRole('form', { name: 'Add factory' });
    await form.getByLabel('Factory code').fill(F2_CODE);
    await form.getByLabel('Factory name').fill(F2_NAME);
    await form.getByRole('button', { name: 'Add factory' }).click();
    await expectToast(page, 'Factory added');
    await expect(od.locator('tbody tr').filter({ hasText: F2_CODE })).toContainText(F2_NAME);
    await od.getByRole('button', { name: 'Close' }).last().click();
    // The super admin's switcher now offers it.
    await expect(page.getByLabel('Active factory').locator('option', { hasText: F2_CODE })).toHaveCount(1);
    const facs = (await api(request, await apiLogin(request, 'superAdmin')).get(`/organizations/${demo._id}/factories`)) as Array<{ _id: string; code: string }>;
    state.f2 = facs.find((f) => f.code === F2_CODE)!._id;
    problems.assertNone();
  });

  test('super admin assigns the factory admin the Factory Admin role in the new factory (Users & roles)', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'superAdmin');
    await page.getByLabel('Active factory').selectOption(state.f1!);
    await page.goto('/users');
    await settle(page);
    await page.getByPlaceholder(/Search/).first().fill('admin@demo.local');
    // (The search is a substring match, so finance-admin@… etc. are listed too.)
    await page.locator('tbody tr').filter({ hasText: 'Factory Admin' }).filter({ hasText: 'admin@demo.local' }).first().click();
    const ud = dialog(page, 'Factory Admin');
    await expect(ud).toBeVisible();
    await ud.getByRole('button', { name: 'Assign role' }).click();
    const ar = dialog(page, /Assign a role to/);
    await ar.getByLabel('Factory').selectOption(state.f2!);
    await ar.getByLabel('Role').selectOption({ label: 'Factory Admin' });
    await ar.getByRole('button', { name: 'Assign role' }).click();
    await expectToast(page, /assigned/i);
    await expect(ud).toContainText(F2_CODE);
    problems.assertNone();
  });

  test('factory admin switches to the new factory: every list is empty, never factory 1 records', async ({ browser, request }) => {
    const { page, session, problems } = await as(browser, request, 'admin', true);
    const a = api(request, session);
    const prs = await a.get('/purchase-requisitions', { limit: 100 });
    state.f1Prs = ((prs.items ?? prs) as Array<{ prNumber: string }>).map((p) => p.prNumber);
    const mats = await a.get('/materials', { limit: 100 });
    state.f1Materials = ((mats.items ?? mats) as Array<{ materialCode: string }>).map((m) => m.materialCode);
    const orders = await a.get('/production-orders', { limit: 100 });
    state.f1Orders = ((orders.items ?? orders) as Array<{ orderNumber: string }>).map((o) => o.orderNumber);
    expect(state.f1Prs.length && state.f1Materials.length && state.f1Orders.length, 'factory 1 has seeded data').toBeTruthy();

    await page.goto('/');
    await settle(page);
    const switcher = page.getByLabel('Active factory');
    await expect(switcher.locator('option', { hasText: F2_CODE })).toHaveCount(1);
    await expect(switcher).toHaveValue(state.f1!);
    await switcher.selectOption(state.f2!);
    await settle(page);
    await expect(switcher).toHaveValue(state.f2!);

    const main = page.locator('#erp-main');
    const noF1 = async (label: string) => {
      const text = await main.innerText();
      for (const code of [...state.f1Prs, ...state.f1Materials.slice(0, 20), ...state.f1Orders]) {
        expect(text.includes(code), `${label}: factory-1 record ${code} must not show in factory 2`).toBeFalsy();
      }
    };
    await expect(main).not.toContainText('NaN');
    await noF1('dashboard');
    for (const [path, label] of [['/purchase', 'purchase'], ['/inventory?tab=materials', 'inventory'], ['/production/orders', 'production']] as const) {
      await page.goto(path);
      await settle(page);
      await expect(switcher).toHaveValue(state.f2!);
      await noF1(label);
    }
    // API agrees with the UI.
    const f2 = api(request, { ...(await apiLogin(request, 'admin')), factoryId: state.f2! });
    const f2Prs = await f2.get('/purchase-requisitions', { limit: 100 });
    expect((f2Prs.items ?? f2Prs).length).toBe(0);
    const f2Orders = await f2.get('/production-orders', { limit: 100 });
    expect((f2Orders.items ?? f2Orders).length).toBe(0);
    problems.assertNone();
  });

  test('factory admin creates a material + requisition in factory 2; invisible from factory 1; switching back restores', async ({ browser, request }) => {
    const { page, problems } = await as(browser, request, 'admin');
    const switcher = page.getByLabel('Active factory');
    await page.goto('/inventory?tab=materials');
    await settle(page);
    await expect(switcher).toHaveValue(state.f2!);
    await page.getByRole('button', { name: 'Add material', exact: true }).first().click();
    const d = page.getByRole('dialog', { name: 'Add material' });
    await d.getByLabel('Code').fill(MAT2);
    await d.getByLabel('Name').fill(`Factory 2 thread ${tag}`);
    await d.getByLabel('Unit cost').fill('10');
    await d.getByRole('button', { name: 'Add material' }).click();
    await expectToast(page, 'Material added');

    state.f2Pr = await createAndSubmitPr(page, MAT2, '30');
    expect(state.f2Pr).toContain(F2_CODE);
    await expect(prRow(page, state.f2Pr)).toBeVisible();

    // Back to factory 1: the factory-2 PR and material are not there, factory-1 data is back.
    await switcher.selectOption(state.f1!);
    await settle(page);
    await page.goto('/purchase');
    await settle(page);
    await expect(page.locator('#erp-main')).toContainText(/PR-F01-/);
    await expect(page.locator('#erp-main')).not.toContainText(state.f2Pr);
    await page.goto('/approvals');
    await settle(page);
    await expect(page.locator('#erp-main')).not.toContainText(state.f2Pr);
    await page.goto('/inventory?tab=materials');
    await settle(page);
    await expect(page.locator('#erp-main')).not.toContainText(MAT2);

    // And again to factory 2.
    await switcher.selectOption(state.f2!);
    await settle(page);
    await page.goto('/purchase');
    await settle(page);
    await expect(prRow(page, state.f2Pr)).toBeVisible();
    await expect(page.locator('#erp-main')).not.toContainText(/PR-F01-/);
    problems.assertNone();
  });

  test('a user with no assignment in factory 2 cannot reach it', async ({ browser, request }) => {
    const store = await apiLogin(request, 'store');
    // API: refused outright.
    const res = await request.get(`${API_URL}/purchase-requisitions`, {
      headers: { Authorization: `Bearer ${store.accessToken}`, 'X-Factory-Id': state.f2! },
    });
    expect(res.status()).toBe(403);

    const { context, page, problems } = await loginWithRefreshCookie(browser, 'store');
    await page.goto('/purchase');
    await settle(page);
    // Not offered in the switcher (single factory → static label, no select).
    await expect(page.getByLabel('Active factory')).toHaveCount(0);
    await expect(page.locator('header.erp-header-bar')).not.toContainText(F2_NAME);

    // Forcing it via storage falls back to an accessible factory — no factory-2 data, no crash.
    await page.evaluate((f2) => localStorage.setItem('factoryId', f2), state.f2!);
    await page.reload();
    await settle(page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('#erp-main')).not.toContainText(state.f2Pr!);
    await expect(page.locator('#erp-main')).toContainText(/PR-F01-/);
    expect(await page.evaluate(() => localStorage.getItem('factoryId'))).toBe(store.factoryId);
    problems.assertNone([/console:.*403/]);
    await context.close();
  });
});

// ───────────────────────────── 4. Silent token refresh ─────────────────────────────

test.describe.serial('Token refresh (backend with JWT_ACCESS_EXPIRY=20s)', () => {
  const email = `${uniq('refresh').toLowerCase()}@demo.local`;
  const password = 'RefreshPass@123';
  let ttlSec = 0;
  let actor: Awaited<ReturnType<typeof loginWithRefreshCookie>> | undefined;
  const refreshCalls: number[] = [];

  test.beforeAll(async ({ request }) => {
    // Throwaway store keeper so locking it never affects the demo accounts.
    const adminS = await apiLogin(request, 'admin');
    const admin = api(request, adminS);
    const me = await admin.get('/users/me');
    const user = await admin.post('/users', {
      email, password, firstName: 'Refresh', lastName: 'Tester', organizationId: me.user.organizationId,
    });
    const roles = (await admin.get('/roles')) as Array<{ _id: string; code: string }>;
    await admin.post(`/users/${user._id}/roles`, {
      roleId: roles.find((r) => r.code === 'STORE_KEEPER')!._id, factoryId: adminS.factoryId, organizationId: me.user.organizationId,
    });
    const s = await apiLoginAs(request, email, password);
    const payload = JSON.parse(Buffer.from(s.accessToken.split('.')[1], 'base64url').toString());
    ttlSec = payload.exp - payload.iat;
  });

  test.afterAll(async () => {
    await actor?.context.close();
  });

  test('after the access token expires, navigation, drawers and creates keep working via /auth/refresh', async ({ browser }) => {
    test.skip(ttlSec > 60, `backend access tokens live ${ttlSec}s — start it with JWT_ACCESS_EXPIRY=20s to run this flow`);
    test.setTimeout(180_000);
    actor = await loginWithRefreshCookie(browser, { email, password });
    const { page, problems } = actor;
    page.on('response', (r) => { if (r.url().includes('/auth/refresh')) refreshCalls.push(r.status()); });
    const unauthorized: string[] = [];
    page.on('response', (r) => { if (r.status() === 401 && !r.url().includes('/auth/')) unauthorized.push(r.url()); });

    await page.goto('/purchase');
    await settle(page);
    await expect(page.getByRole('heading', { name: 'Purchase', exact: true })).toBeVisible();
    expect(refreshCalls, 'no refresh needed while the token is fresh').toHaveLength(0);

    await page.waitForTimeout((ttlSec + 5) * 1000);

    // 1. Navigate lists
    await page.goto('/inventory?tab=materials');
    await settle(page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('row').filter({ hasText: 'BTN-001' }).first()).toBeVisible();
    expect(refreshCalls.length, 'a silent refresh happened').toBeGreaterThan(0);
    expect(refreshCalls.every((s) => s === 200), `refresh statuses ${refreshCalls}`).toBeTruthy();
    expect(unauthorized.length, 'the expired token was actually rejected first').toBeGreaterThan(0);

    // 2. Open a drawer after another expiry (in-app navigation, no reload)
    await page.waitForTimeout((ttlSec + 5) * 1000);
    const before = refreshCalls.length;
    await page.locator('aside[aria-label="Sidebar"]').getByRole('link', { name: 'Purchase' }).click();
    await expect(page).toHaveURL(/\/purchase/);
    await page.getByRole('button', { name: 'New requisition' }).first().click();
    await expect(page.getByRole('dialog', { name: 'New purchase requisition' })).toBeVisible();
    await page.getByRole('dialog', { name: 'New purchase requisition' }).getByRole('button', { name: 'Cancel' }).click();

    // 3. Create something after yet another expiry
    await page.waitForTimeout((ttlSec + 5) * 1000);
    const pr = await createAndSubmitPr(page, 'BTN-001', '12');
    await expect(prRow(page, pr)).toBeVisible();
    expect(refreshCalls.length).toBeGreaterThan(before);
    expect(refreshCalls.every((s) => s === 200)).toBeTruthy();
    await expect(page).not.toHaveURL(/\/login/);
    problems.assertNone([/console:.*401/]);
  });

  test('after an admin locks the user, the next refresh fails and the user lands on /login cleanly', async ({ browser, request }) => {
    test.skip(ttlSec > 60, `backend access tokens live ${ttlSec}s — start it with JWT_ACCESS_EXPIRY=20s to run this flow`);
    test.setTimeout(120_000);
    expect(actor, 'previous test signed the user in').toBeTruthy();
    const { page, problems } = actor!;
    problems.clear();

    const admin = await loginWithRefreshCookie(browser, 'admin');
    await admin.page.goto('/users');
    await settle(admin.page);
    await admin.page.getByPlaceholder(/Search/).first().fill(email);
    await admin.page.locator('tbody tr').filter({ hasText: email }).first().click();
    const ud = dialog(admin.page, 'Refresh Tester');
    await ud.getByRole('button', { name: 'More' }).click();
    await admin.page.getByRole('menuitem', { name: 'Lock account' }).click();
    await dialog(admin.page, /^Lock /).getByRole('button', { name: 'Lock account' }).click();
    await expectToast(admin.page, 'Account locked');
    admin.problems.assertNone();
    await admin.context.close();

    const before = refreshCalls.length;
    await page.locator('aside[aria-label="Sidebar"]').getByRole('link', { name: 'Inventory' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(refreshCalls.slice(before).some((s) => s === 401), 'refresh refused for the locked user').toBeTruthy();
    expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
    // Clean landing: no crash, no stack of error toasts on the login page.
    problems.assertNone([/console:.*401/, /error toast: .*(locked|session|sign in|expired)/i]);
    expect((await apiLoginWith(request, email, password)).ok, 'locked user cannot sign in again').toBeFalsy();
  });
});
