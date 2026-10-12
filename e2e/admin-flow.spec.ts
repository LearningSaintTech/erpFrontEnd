import { test, expect, type Page } from '@playwright/test';
import {
  api, apiLogin, apiLoginAs, apiLoginWith, expectToast, loginAs, openSession, uniq,
} from './helpers';

/**
 * Administration flows driven through the UI: dashboard, approvals, users & roles, settings,
 * audit, reports, notifications and the super-admin organizations page.
 * API calls are only used for setup and assertions.
 */

/** A modal/drawer/confirm by its title text. */
const dialog = (page: Page, title: string | RegExp) =>
  page.locator('[role="dialog"], [role="alertdialog"]').filter({ has: page.getByText(title, { exact: false }) }).last();

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

// ─────────────────────────────── Dashboard ───────────────────────────────

test('Dashboard: attention cards deep-link, KPIs and period selector (admin + roles)', async ({ browser, request }) => {
  const { context, page, problems } = await loginAs(browser, request, 'admin');
  await page.goto('/');
  await settle(page);
  const attention = page.locator('#erp-main');
  await expect(page.getByRole('heading', { name: 'Needs your attention' })).toBeVisible({ timeout: 30_000 });
  await expect(attention).not.toContainText('Checking your queues', { timeout: 15_000 });

  const cards: Array<{ label: string; url: RegExp }> = [
    { label: 'Approvals for you', url: /\/approvals\?tab=inbox$/ },
    { label: 'Batches for final QC', url: /\/quality\/inspections\?tab=final$/ },
    { label: 'Samples to inspect', url: /\/quality\/inspections\?tab=samples$/ },
    { label: 'Goods receipts to inspect', url: /\/quality\/inspections\?tab=incoming$/ },
    { label: 'Low stock materials', url: /\/inventory\?tab=alerts$/ },
    { label: 'Unpaid payments', url: /\/purchase\?tab=po$/ },
    { label: 'Overdue orders', url: /\/production\/orders\?filter=overdue$/ },
  ];
  for (const c of cards) {
    problems.clear();
    await page.goto('/');
    const link = page.getByRole('link', { name: new RegExp(c.label) }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page, `${c.label} deep link`).toHaveURL(c.url);
    await settle(page);
    if (c.label === 'Approvals for you') await expect(page.getByRole('tab', { name: /Inbox/ })).toHaveAttribute('aria-selected', 'true');
    if (c.label === 'Low stock materials') await expect(page.getByRole('tab', { name: /^Alerts/ })).toHaveAttribute('aria-selected', 'true');
    problems.assertNone();
  }

  // KPI tiles + period selector
  await page.goto('/');
  await settle(page);
  const period = page.getByLabel('Period');
  await expect(period).toBeVisible();
  const options = await period.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(options.length).toBeGreaterThan(1);
  for (const v of options) {
    problems.clear();
    await period.selectOption(v);
    await settle(page);
    await expect(page.locator('#erp-main')).not.toContainText('NaN');
    problems.assertNone();
  }
  await context.close();

  // A couple of other roles: dashboard renders, no errors, cards only for their modules
  for (const role of ['store', 'qc', 'designer'] as const) {
    const s = await loginAs(browser, request, role);
    await s.page.goto('/');
    await settle(s.page);
    await expect(s.page.locator('#erp-main')).not.toContainText('NaN');
    if (role === 'designer') await expect(s.page.getByRole('link', { name: /Unpaid payments/ })).toHaveCount(0);
    if (role === 'qc') await expect(s.page.getByRole('link', { name: /Goods receipts to inspect/ })).toBeVisible();
    // Store keeper sees their own work, not finance's or the planners'.
    if (role === 'store') {
      await expect(s.page.getByRole('link', { name: /Stock to put away/ })).toBeVisible();
      await expect(s.page.getByRole('link', { name: /Unpaid payments/ })).toHaveCount(0);
    }
    s.problems.assertNone();
    await s.context.close();
  }
});

// ─────────────────────────────── Approvals ───────────────────────────────

test('Approvals: approve, request changes, reject with required comment; drawer; history; deep links', async ({ browser, request }) => {
  const { context, page, session, problems } = await loginAs(browser, request, 'admin');
  const a = api(request, session);
  const pending = await a.get('/approvals/pending', { limit: 50 });
  type Item = { _id: string; documentType: string; documentSummary?: { code?: string }; submittedBy?: string | { _id: string } };
  // Separation of duties: the admin can't decide on documents they submitted themselves.
  const items = ((pending.items ?? pending) as Item[]).filter((i) => {
    const by = typeof i.submittedBy === 'object' ? i.submittedBy?._id : i.submittedBy;
    return by !== session.userId;
  });
  // The demo seed has 3 decidable items (2 designs + 1 PR). Decisions are permanent, so this test
  // needs a freshly seeded backend (restart the in-memory API between full runs).
  expect(items.length, 'decidable approvals in the seed — restart the in-memory backend to reseed').toBeGreaterThanOrEqual(3);
  const codes = items.map((i) => i.documentSummary!.code!);
  const [toApprove, toChange, toReject] = codes;

  await page.goto('/approvals');
  await settle(page);
  const row = (code: string) => page.locator('li').filter({ has: page.getByRole('button', { name: code, exact: true }) });

  // Detail drawer + history
  await row(toApprove).getByRole('button', { name: toApprove, exact: true }).click();
  const drawer = dialog(page, toApprove);
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('Submitted by');
  await expect(drawer.getByRole('heading', { name: 'History' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Close' }).last().click();
  await expect(drawer).toBeHidden();

  // Approve (comment optional)
  await row(toApprove).getByRole('button', { name: /^Approve/ }).click();
  const ap = dialog(page, `Approve ${toApprove}?`);
  await expect(ap).toBeVisible();
  await ap.getByRole('button', { name: 'Approve', exact: true }).click();
  await expectToast(page, `${toApprove} approved`);
  await expect(row(toApprove)).toHaveCount(0);

  // Request changes — comment required
  await row(toChange).getByRole('button', { name: 'Request changes' }).click();
  const rc = dialog(page, `Request changes on ${toChange}`);
  await rc.getByRole('button', { name: 'Send back' }).click();
  await expect(rc.getByRole('alert')).toBeVisible();
  await expect(rc).toBeVisible();
  await rc.getByRole('textbox').fill('Please fix the size chart.');
  await rc.getByRole('button', { name: 'Send back' }).click();
  await expectToast(page, `${toChange} sent back for changes`);

  // Reject via row menu — reason required
  await row(toReject).getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Reject/ }).click();
  const rj = dialog(page, `Reject ${toReject}?`);
  await rj.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(rj.getByRole('alert')).toBeVisible();
  await rj.getByRole('textbox').fill('Duplicate request.');
  await rj.getByRole('button', { name: 'Reject', exact: true }).click();
  await expectToast(page, `${toReject} rejected`);
  problems.assertNone();

  // History tab + filters
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page).toHaveURL(/tab=history/);
  await settle(page);
  const outcome = page.getByLabel('Outcome');
  await outcome.selectOption('REJECTED');
  await expect(page.locator('tbody')).toContainText(toReject);
  await outcome.selectOption('APPROVED');
  await expect(page.locator('tbody')).toContainText(toApprove);
  await outcome.selectOption('CHANGES_REQUESTED');
  await expect(page.locator('tbody')).toContainText(toChange);
  await page.getByLabel('Document type').selectOption('PURCHASE_REQUISITION');
  await expect(page.locator('tbody')).not.toContainText(toChange);
  problems.assertNone();

  // ?tab= deep links
  await page.goto('/approvals?tab=workflows');
  await expect(page.getByRole('tab', { name: 'Workflows' })).toHaveAttribute('aria-selected', 'true');
  await page.goto('/approvals?tab=history');
  await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  problems.assertNone();
  await context.close();
});

test('Approvals: create a 2-level PR workflow, then deactivate it', async ({ browser, request }) => {
  const { context, page, session, problems } = await loginAs(browser, request, 'admin');
  const name = uniq('E2E PR two-step');
  await page.goto('/approvals?tab=workflows');
  await settle(page);
  await page.getByRole('button', { name: 'New workflow' }).first().click();
  const d = dialog(page, 'New approval workflow');
  await expect(d).toBeVisible();
  await d.getByLabel('Document type').selectOption('PURCHASE_REQUISITION');
  // Validation: name required
  await d.getByRole('button', { name: 'Create workflow' }).click();
  await expect(d.getByText(/Enter a name/)).toBeVisible();
  await d.getByLabel('Workflow name').fill(name);
  await d.getByRole('button', { name: 'Add level' }).click();
  const whoSelects = d.getByLabel('Who approves');
  await expect(whoSelects).toHaveCount(2);
  const allowed = await whoSelects.nth(1).locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(allowed.length).toBeGreaterThan(0);
  await whoSelects.nth(1).selectOption(allowed[allowed.length - 1]);
  await d.getByRole('button', { name: 'Create workflow' }).click();
  await expectToast(page, 'Workflow created');
  await expect(d).toBeHidden();
  const wfRow = page.locator('tbody tr').filter({ hasText: name });
  await expect(wfRow).toContainText('L1:');
  await expect(wfRow).toContainText('L2:');

  const wf = (await api(request, session).get('/approval-workflows')) as Array<{ name: string; levels: unknown[] }>;
  expect(wf.find((w) => w.name === name)?.levels).toHaveLength(2);

  // Deactivate (confirm)
  await wfRow.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  const c = dialog(page, `Deactivate "${name}"?`);
  await c.getByRole('button', { name: 'Deactivate' }).click();
  await expectToast(page, 'Workflow deactivated');
  await expect(page.locator('tbody tr').filter({ hasText: name })).toHaveCount(0);
  await page.getByLabel('Show inactive workflows').check();
  await expect(page.locator('tbody tr').filter({ hasText: name })).toContainText(/Inactive/i);
  problems.assertNone();
  await context.close();
});

// ─────────────────────────────── Users & roles ───────────────────────────────

test('Users: create with first role, edit, assign/remove role, reset password, lock/unlock, deactivate/activate', async ({ browser, request }) => {
  test.setTimeout(240_000);
  const { context, page, session, problems } = await loginAs(browser, request, 'admin');
  const tag = uniq('qa').toLowerCase();
  const email = `${tag}@demo.local`;
  const password = 'TempPass@123';

  await page.goto('/users');
  await settle(page);
  await page.getByRole('button', { name: 'New user' }).first().click();
  const d = dialog(page, 'New user');
  await d.getByRole('button', { name: 'Create user' }).click();
  await expect(d.getByText('Enter a first name.')).toBeVisible();
  await d.getByLabel('First name').fill('Qa');
  await d.getByLabel('Last name').fill('Tester');
  await d.getByLabel('Work email').fill(email);
  await d.getByLabel('Temporary password').fill(password);
  await d.getByLabel('Role').selectOption({ label: 'Quality Inspector' });
  await d.getByRole('button', { name: 'Create user' }).click();
  await expectToast(page, 'User created');

  const login1 = await apiLoginWith(request, email, password);
  expect(login1.ok, `new user can sign in: ${login1.body?.error?.message}`).toBeTruthy();
  expect(login1.body.data.permissions).toContain('quality.read');

  // Detail drawer (opens after create, or from the table)
  let ud = dialog(page, 'Qa Tester');
  if (!(await ud.isVisible().catch(() => false))) {
    await page.getByPlaceholder(/Search/).first().fill(tag);
    await page.locator('tbody tr').filter({ hasText: email }).first().click();
    ud = dialog(page, 'Qa Tester');
  }
  await expect(ud).toBeVisible();
  await expect(ud).toContainText('Quality Inspector');

  // Edit profile
  await ud.getByRole('button', { name: 'Edit profile' }).click();
  await ud.getByLabel('Last name').fill('Tester-Edited');
  await ud.getByRole('button', { name: 'Save profile' }).click();
  await expectToast(page, /saved|updated/i);
  ud = dialog(page, 'Qa Tester-Edited');
  await expect(ud).toBeVisible();

  // Assign another role at the factory
  await ud.getByRole('button', { name: 'Assign role' }).click();
  const ar = dialog(page, /Assign a role to/);
  await ar.getByLabel('Role').selectOption({ label: 'Auditor' });
  await ar.getByRole('button', { name: 'Assign role' }).click();
  await expectToast(page, /assigned/i);
  await expect(ud).toContainText('Auditor');

  // Remove a role (confirm)
  await ud.getByRole('button', { name: 'Remove Auditor' }).click();
  const rm = dialog(page, 'Remove Auditor?');
  await rm.getByRole('button', { name: /Remove/ }).last().click();
  await expectToast(page, /removed/i);
  await expect(ud.getByRole('button', { name: 'Remove Auditor' })).toHaveCount(0);

  // Reset password (prompt)
  const newTemp = 'Reset@12345';
  await ud.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Reset password…' }).click();
  const rp = dialog(page, /Reset password for/);
  await rp.getByLabel('Temporary password').fill('short');
  await rp.getByRole('button', { name: 'Reset password' }).click();
  await expect(rp.getByRole('alert')).toBeVisible();
  await rp.getByLabel('Temporary password').fill(newTemp);
  await rp.getByRole('button', { name: 'Reset password' }).click();
  await expectToast(page, 'Password reset');
  expect((await apiLoginWith(request, email, password)).ok, 'old password refused').toBeFalsy();
  expect((await apiLoginWith(request, email, newTemp)).ok, 'new temp password works').toBeTruthy();

  // Lock → login fails; unlock → login works
  await ud.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Lock account' }).click();
  await dialog(page, /^Lock /).getByRole('button', { name: 'Lock account' }).click();
  await expectToast(page, 'Account locked');
  const locked = await apiLoginWith(request, email, newTemp);
  expect(locked.ok, 'locked user cannot sign in').toBeFalsy();
  await ud.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Unlock account' }).click();
  await dialog(page, /^Unlock /).getByRole('button', { name: 'Unlock' }).click();
  await expectToast(page, 'Account unlocked');
  expect((await apiLoginWith(request, email, newTemp)).ok, 'unlocked user can sign in').toBeTruthy();

  // Deactivate → login fails; activate → works
  await ud.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await dialog(page, /^Deactivate /).getByRole('button', { name: 'Deactivate' }).click();
  await expectToast(page, 'User deactivated');
  expect((await apiLoginWith(request, email, newTemp)).ok, 'inactive user cannot sign in').toBeFalsy();
  await ud.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Activate' }).click();
  await expectToast(page, 'User activated');
  expect((await apiLoginWith(request, email, newTemp)).ok, 'reactivated user can sign in').toBeTruthy();

  // Status filter shows them as active
  await ud.getByRole('button', { name: 'Close' }).last().click();
  await page.getByLabel('Status').selectOption('ACTIVE');
  await page.getByPlaceholder(/Search/).first().fill(tag);
  await expect(page.locator('tbody tr').filter({ hasText: email })).toHaveCount(1);
  void session;
  problems.assertNone();
  await context.close();
});

test('Roles: create custom role via matrix (incl. chat.group.*), duplicate, edit, delete', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { context, page, session, problems } = await loginAs(browser, request, 'admin');
  const a = api(request, session);
  const name = uniq('QA Lead');
  const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

  await page.goto('/users?tab=roles');
  await expect(page.getByRole('tab', { name: /Roles/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'New role' }).first().click();
  const d = dialog(page, 'New role');
  await d.getByLabel('Display name').fill(name);
  await d.getByLabel('Code').fill(code);
  await d.getByRole('checkbox', { name: 'Select all Quality permissions' }).check();
  await d.getByRole('checkbox', { name: 'Select all Chat permissions' }).check();
  await d.getByRole('button', { name: 'Create role' }).click();
  await expectToast(page, /created/i);

  const roles = (await a.get('/roles')) as Array<{ _id: string; name: string; code: string; permissions: string[] }>;
  const created = roles.find((r) => r.code === code);
  expect(created, 'role saved').toBeTruthy();
  expect(created!.permissions).toEqual(expect.arrayContaining(['quality.read', 'chat.group.create', 'chat.group.manage']));

  // Open → edit (toggle one permission) → save
  await page.getByPlaceholder(/Search/).first().fill(name);
  await page.locator('tbody tr').filter({ hasText: name }).first().click();
  let rd = dialog(page, name);
  await expect(rd).toBeVisible();
  const inspectionToggle = rd.getByRole('checkbox', { name: 'Select all Reports permissions' });
  await inspectionToggle.check();
  await rd.getByRole('button', { name: /Save/ }).click();
  await expectToast(page, /saved|updated/i);
  const afterEdit = ((await a.get('/roles')) as typeof roles).find((r) => r.code === code)!;
  expect(afterEdit.permissions.some((p) => p.startsWith('report.'))).toBeTruthy();
  if (!(await rd.isVisible().catch(() => false))) {
    await page.locator('tbody tr').filter({ hasText: name }).first().click();
    rd = dialog(page, name);
  }

  // Duplicate
  await rd.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate as new role' }).click();
  const dup = dialog(page, `Duplicate ${name}`);
  await expect(dup).toBeVisible();
  const dupName = `${name} copy`;
  await dup.getByLabel('Display name').fill(dupName);
  await dup.getByLabel('Code').fill(`${code}_COPY`);
  await dup.getByRole('button', { name: 'Create role' }).click();
  await expectToast(page, /created/i);
  const dupRole = ((await a.get('/roles')) as typeof roles).find((r) => r.code === `${code}_COPY`);
  expect(dupRole?.permissions.sort()).toEqual(afterEdit.permissions.sort());

  // Delete both
  for (const n of [dupName, name]) {
    await page.getByPlaceholder(/Search/).first().fill(n);
    await page.locator('tbody tr').filter({ hasText: n }).first().click();
    rd = dialog(page, n);
    await rd.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Delete role' }).click();
    await dialog(page, `Delete ${n}?`).getByRole('button', { name: /Delete/ }).last().click();
    await expectToast(page, /deleted/i);
  }
  const left = (await a.get('/roles')) as typeof roles;
  expect(left.find((r) => r.code === code || r.code === `${code}_COPY`)).toBeFalsy();
  problems.assertNone();
  await context.close();
});

test('Delegations: create (now → +7d) and revoke', async ({ browser, request }) => {
  const { context, page, problems } = await loginAs(browser, request, 'admin');
  await page.goto('/users?tab=delegations');
  await settle(page);
  await page.getByRole('button', { name: 'New delegation' }).first().click();
  const d = dialog(page, 'New delegation');
  await d.getByRole('button', { name: 'Create delegation' }).click();
  await expect(d.getByText('Choose who receives the permissions.')).toBeVisible();
  const opts = await d.getByLabel('Delegate to').locator('option').allTextContents();
  const target = opts.find((o) => /Quality Inspector/.test(o)) || opts[1];
  await d.getByLabel('Delegate to').selectOption({ label: target });
  // default window is now → +7 days
  const start = await d.getByLabel('Starts').inputValue();
  const end = await d.getByLabel('Ends').inputValue();
  expect(Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)).toBe(7);
  await d.getByRole('checkbox', { name: 'Select all Approvals permissions' }).check();
  await d.getByRole('button', { name: 'Create delegation' }).click();
  await expectToast(page, 'Delegation created');
  const row = page.locator('tbody tr').filter({ hasText: target }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Revoke' }).click();
  await dialog(page, /Revoke/).getByRole('button', { name: /Revoke/ }).last().click();
  await expectToast(page, /revoked/i);
  problems.assertNone();
  await context.close();
});

// ─────────────────────────────── Settings ───────────────────────────────

test('Settings: general + factory settings, sticky save bar, discard, stages, integrations', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { context, page, problems } = await loginAs(browser, request, 'admin');
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/settings\/general$/);
  await settle(page);

  // General: edit → save bar → discard → edit → save
  const days = page.getByLabel(/Warn when stock covers fewer than/);
  const original = await days.inputValue();
  await days.fill(String(Number(original || 7) === 9 ? 10 : 9));
  const bar = page.getByRole('region', { name: 'Unsaved changes' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Discard' }).click();
  await expect(bar).toBeHidden();
  await expect(days).toHaveValue(original);
  const target = original === '12' ? '13' : '12';
  await days.fill(target);
  await bar.getByRole('button', { name: /Save/ }).click();
  await expectToast(page, /saved/i);
  await expect(bar).toBeHidden();
  await page.reload();
  await expect(page.getByLabel(/Warn when stock covers fewer than/)).toHaveValue(target);

  // Factory settings: reorder stages, reject QC, save
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: /^Factory/ }).click();
  await expect(page).toHaveURL(/\/settings\/factory-settings$/);
  await settle(page);
  const stagesList = page.locator('section').filter({ hasText: 'Production stages' }).locator('ol li');
  const firstBefore = (await stagesList.nth(0).innerText()).replace(/^\d+\s*/, '').trim().split('\n')[0];
  const secondBefore = (await stagesList.nth(1).innerText()).replace(/^\d+\s*/, '').trim().split('\n')[0];
  await page.getByRole('button', { name: `Move ${secondBefore} up` }).click();
  await expect(stagesList.nth(0)).toContainText(secondBefore);
  await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible();

  const newStage = page.getByLabel('New stage name');
  await newStage.fill('QC');
  await page.getByRole('button', { name: 'Add stage' }).click();
  await expect(page.getByText(/added automatically/)).toBeVisible();
  await newStage.fill('Packing');
  await page.getByRole('button', { name: 'Add stage' }).click();
  await expect(stagesList.last()).toContainText('Packing');
  await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: /Save/ }).click();
  await expectToast(page, 'Factory settings saved');
  await page.reload();
  await settle(page);
  await expect(stagesList.nth(0)).toContainText(secondBefore);
  await expect(stagesList.nth(1)).toContainText(firstBefore);
  await expect(stagesList.last()).toContainText('Packing');

  // Restore the original order — other flows (make-to-ship) depend on the factory's stages.
  await page.getByRole('button', { name: `Move ${firstBefore} up` }).click();
  await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: /Save/ }).click();
  await expectToast(page, 'Factory settings saved');
  await page.reload();
  await settle(page);
  await expect(stagesList.nth(0)).toContainText(firstBefore);
  await expect(stagesList.nth(1)).toContainText(secondBefore);

  // Leaving with unsaved changes asks first (this move is discarded, not saved)
  await page.getByRole('button', { name: `Move ${secondBefore} up` }).click();
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: /^Integrations/ }).click();
  const leave = dialog(page, 'Discard unsaved changes?');
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: /Discard|Leave/ }).last().click();
  await expect(page).toHaveURL(/\/settings\/integrations$/);
  await settle(page);

  // Integrations: toggle SMS → save → reload persists → toggle back
  const sms = page.getByRole('switch', { name: 'SMS sending' });
  const was = (await sms.getAttribute('aria-checked')) === 'true';
  await sms.click();
  await expect(sms).toHaveAttribute('aria-checked', String(!was));
  await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: /Save/ }).click();
  await expectToast(page, /saved/i);
  await page.reload();
  await expect(page.getByRole('switch', { name: 'SMS sending' })).toHaveAttribute('aria-checked', String(!was));
  await page.getByRole('switch', { name: 'SMS sending' }).click();
  await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: /Save/ }).click();
  await expectToast(page, /saved/i);
  problems.assertNone();
  await context.close();
});

test('Settings: inventory codes create / edit / delete', async ({ browser, request }) => {
  const { context, page, problems } = await loginAs(browser, request, 'admin');
  const code = uniq('QA').replace(/-/g, '').slice(0, 10);
  await page.goto('/settings/inventory-codes');
  await settle(page);
  await page.getByRole('button', { name: 'New code' }).first().click();
  const d = dialog(page, 'New inventory code');
  await d.getByLabel(/^Code/).fill(code);
  await d.getByLabel(/^Name/).fill('QA test code');
  await d.getByRole('button', { name: 'Create code' }).click();
  await expectToast(page, /created|saved/i);
  await page.getByPlaceholder(/Search code/).fill(code);
  const row = page.locator('tbody tr').filter({ hasText: code });
  await expect(row).toHaveCount(1);

  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Edit/ }).click();
  const e = dialog(page, `Edit ${code}`);
  await e.getByLabel(/^Name/).fill('QA test code edited');
  await e.getByRole('button', { name: 'Save changes' }).click();
  await expectToast(page, /saved|updated/i);
  await expect(row).toContainText('QA test code edited');

  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await dialog(page, /Delete/).getByRole('button', { name: 'Delete code' }).click();
  await expectToast(page, /deleted/i);
  await expect(row).toHaveCount(0);
  problems.assertNone();
  await context.close();
});

test('My account: wrong current password shows inline error and keeps session; correct one works', async ({ browser, request }) => {
  // Throwaway user created via API so demo accounts keep their passwords.
  const admin = api(request, await apiLogin(request, 'admin'));
  const me = await admin.get('/users/me');
  const email = `${uniq('pw').toLowerCase()}@demo.local`;
  const pw1 = 'FirstPass@123';
  const pw2 = 'SecondPass@456';
  const user = await admin.post('/users', {
    email, password: pw1, firstName: 'Pw', lastName: 'Changer', organizationId: me.user.organizationId,
  });
  const roles = (await admin.get('/roles')) as Array<{ _id: string; code: string }>;
  await admin.post(`/users/${user._id}/roles`, {
    roleId: roles.find((r) => r.code === 'AUDITOR')!._id, factoryId: me.factories[0]._id, organizationId: me.user.organizationId,
  });

  const { context, page, problems } = await openSession(browser, await apiLoginAs(request, email, pw1));
  await page.goto('/');
  await page.getByRole('button', { name: /Account menu for/ }).click();
  await page.getByRole('menuitem', { name: 'My account' }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);

  await page.getByLabel('Current password').fill('WrongPass@000');
  await page.getByLabel(/^New password/).fill(pw2);
  await page.getByLabel('Confirm new password').fill(pw2);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Current password is incorrect')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/account$/);
  // Still signed in: navigation works
  await page.goto('/');
  await expect(page.locator('#erp-main')).toBeVisible();
  await expect(page).not.toHaveURL(/login/);
  problems.assertNone([/error toast: Current password is incorrect/, /console:.*400/]);
  problems.clear();

  await page.goto('/settings/account');
  await page.getByLabel('Current password').fill(pw1);
  await page.getByLabel(/^New password/).fill(pw2);
  await page.getByLabel('Confirm new password').fill(pw2);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expectToast(page, 'Password changed');
  expect((await apiLoginWith(request, email, pw1)).ok, 'old password refused').toBeFalsy();
  expect((await apiLoginWith(request, email, pw2)).ok, 'new password works').toBeTruthy();
  problems.assertNone();
  await context.close();
});

// ─────────────────────────────── Audit / reports / notifications ───────────────────────────────

test('Audit log: filters, detail drawer, readable module names', async ({ browser, request }) => {
  const { context, page, problems } = await loginAs(browser, request, 'admin');
  await page.goto('/audit');
  await settle(page);
  const moduleSel = page.getByLabel('Module');
  const moduleLabels = await moduleSel.locator('option').allTextContents();
  expect(moduleLabels.length).toBeGreaterThan(1);
  for (const l of moduleLabels) expect(l, 'module label readable').not.toMatch(/^v\d+$|^api$/i);
  const cells = await page.locator('tbody tr td:nth-child(4)').allTextContents();
  for (const c of cells) expect(c.trim(), 'module cell readable').not.toMatch(/^v\d+$/i);

  // Filters
  const firstModule = await moduleSel.locator('option').nth(1).getAttribute('value');
  await moduleSel.selectOption(firstModule!);
  await settle(page);
  await page.getByLabel('Date range').selectOption({ index: 1 });
  await settle(page);
  await page.getByLabel('Action', { exact: true }).selectOption({ index: 1 });
  await settle(page);
  await page.getByPlaceholder('Filter by user email…').fill('admin@');
  await settle(page);
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page.getByLabel('Module')).toHaveValue('');
  await settle(page);

  // Detail drawer
  await page.locator('tbody tr').first().click();
  const drawer = page.locator('[role="dialog"]:visible').last();
  await expect(drawer).toBeVisible();
  // The module must be a readable name (it used to be "v1" for every request). The endpoint
  // line legitimately contains /api/v1/, so only check the text right after "Module".
  await expect(drawer).toContainText(/Module\s*[A-Z][a-z]/);
  await expect(drawer).not.toContainText(/Module\s*v1/i);
  await drawer.getByRole('button', { name: 'Close' }).last().click();
  problems.assertNone();
  await context.close();
});

test('Reports: every tab loads, period filter, export', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { context, page, problems } = await loginAs(browser, request, 'admin');
  await page.goto('/reports');
  await expect(page).toHaveURL(/\/reports\/factory$/);
  await settle(page);
  const tabs = page.getByRole('tablist').first().getByRole('tab');
  const n = await tabs.count();
  expect(n).toBeGreaterThan(1);
  for (let i = 0; i < n; i++) {
    problems.clear();
    await tabs.nth(i).click();
    await settle(page);
    await expect(page.locator('[aria-label="Loading report"]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('#erp-main')).not.toContainText('NaN');
    problems.assertNone();
  }
  await page.getByLabel('Period').selectOption({ index: 1 });
  await settle(page);
  const download = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const dl = await download;
  if (!dl) await expectToast(page, /exported/i);
  problems.assertNone();
  await context.close();
});

test('Notifications page: tabs and filters', async ({ browser, request }) => {
  const { context, page, problems } = await loginAs(browser, request, 'admin');
  await page.goto('/notifications');
  await settle(page);
  for (const t of ['Unread', 'Read', 'All']) {
    await page.getByRole('tab', { name: new RegExp(`^${t}`) }).click();
    await settle(page);
  }
  const ev = page.getByLabel('Event type');
  if (await ev.locator('option').count() > 1) await ev.selectOption({ index: 1 });
  await settle(page);
  await page.getByLabel('Period').selectOption({ index: 1 });
  await settle(page);
  problems.assertNone();
  await context.close();
});

// ─────────────────────────────── Super admin ───────────────────────────────

test('Super admin: organizations page', async ({ browser, request }) => {
  const { context, page, problems } = await loginAs(browser, request, 'superAdmin');
  await page.goto('/');
  await page.locator('aside[aria-label="Sidebar"]').getByRole('link', { name: 'Organizations' }).click();
  await expect(page).toHaveURL(/\/admin\/organizations$/);
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.getByPlaceholder('Search organizations…').fill('zzzz-none');
  await expect(page.getByText('No organizations match')).toBeVisible();
  problems.assertNone();
  await context.close();

  // A factory admin is bounced from the organizations page
  const fa = await loginAs(browser, request, 'admin');
  await fa.page.goto('/admin/organizations');
  await expect(fa.page).toHaveURL(/\/$/);
  await fa.context.close();
});
