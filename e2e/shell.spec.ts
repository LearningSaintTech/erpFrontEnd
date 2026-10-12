import { test, expect, type Page } from '@playwright/test';
import { API_URL, USERS, api, apiLogin, loginAs, watchProblems, type RoleKey } from './helpers';

/**
 * App shell, driven through the UI per role: login page, permission-filtered sidebar (every visible
 * link opens a page without errors), breadcrumbs, collapse persistence, Ctrl+K palette, avatar menu,
 * sign out, notifications bell, chat, and the mobile drawer / no horizontal overflow.
 */

async function expectNoHorizontalOverflow(page: Page, where: string) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, `horizontal page overflow on ${where}: scrollWidth ${sw} > innerWidth ${iw}`).toBeLessThanOrEqual(iw);
}

/** Wait for the routed page to settle: no skeleton/loading, main has content. */
async function expectPageRendered(page: Page, where: string) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const main = page.locator('#erp-main');
  await expect(main, `main area on ${where}`).toBeVisible();
  await expect.poll(async () => (await main.innerText()).trim().length, { message: `blank page on ${where}`, timeout: 10_000 })
    .toBeGreaterThan(10);
}

/** Every href in the desktop sidebar (dropdown parents expanded). */
async function sidebarHrefs(page: Page): Promise<string[]> {
  const sidebar = page.locator('aside[aria-label="Sidebar"]');
  const closed = sidebar.locator('button.erp-nav-dropdown-trigger[aria-expanded="false"]');
  while (await closed.count()) await closed.first().click();
  return sidebar.locator('nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''));
}

async function clickSidebarLink(page: Page, href: string) {
  const sidebar = page.locator('aside[aria-label="Sidebar"]');
  const closed = sidebar.locator('button.erp-nav-dropdown-trigger[aria-expanded="false"]');
  while (await closed.count()) await closed.first().click();
  await sidebar.locator(`nav a[href="${href}"]`).first().click();
}

const ROLES: RoleKey[] = ['admin', 'designer', 'store', 'qc', 'operator', 'auditor', 'finance'];

/** Admin-area links and the permission each needs. */
const GUARDED: Array<{ href: string; perm: string }> = [
  { href: '/users', perm: 'user.read' },
  { href: '/settings', perm: 'settings.configure' },
  { href: '/audit', perm: 'audit.read' },
  { href: '/purchase', perm: 'purchase.read' },
  { href: '/inventory', perm: 'inventory.read' },
  { href: '/quality/inspections', perm: 'quality.read' },
  { href: '/production/orders', perm: 'production.read' },
];

test.describe('Login page', () => {
  test('phone OTP form renders, validates and shows API errors', async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    const phone = page.locator('#login-phone');
    await expect(phone).toBeVisible();
    await expect(page.getByLabel('Country code')).toHaveValue('+91');

    // Client-side validation: invalid number
    await phone.fill('12345');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByRole('alert')).toContainText('valid 10-digit');

    // Non-digits are stripped and length capped
    await phone.fill('98a76-5432109999');
    await expect(phone).toHaveValue('9876543210');
    // A pasted number with +91 prefix and spaces keeps all 10 digits
    await phone.fill('+91 98765 43210');
    await expect(phone).toHaveValue('9876543210');

    // Unknown number → server error shown inline, still on /login
    await phone.fill('9000000001');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).not.toContainText('valid 10-digit');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    problems.assertNone([/console: .*(40\d|status of)/]);
  });

  test('protected routes redirect to /login when signed out', async ({ page }) => {
    for (const path of ['/', '/users', '/settings/general', '/approvals']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });
});

for (const role of ROLES) {
  test.describe(`Shell as ${role}`, () => {
    test(`sidebar is permission-filtered and every link opens cleanly (${role})`, async ({ browser, request }) => {
      test.setTimeout(240_000);
      const { context, page, session, problems } = await loginAs(browser, request, role);
      const me = await api(request, session).get('/users/me');
      const perms: string[] = me.permissions;
      const can = (p: string) => perms.includes('*') || perms.includes(p);

      await page.goto('/');
      await expectPageRendered(page, `${role} /`);
      const hrefs = await sidebarHrefs(page);
      expect(hrefs.length).toBeGreaterThan(0);

      // Only permitted sections are shown
      for (const g of GUARDED) {
        const shown = hrefs.some((h) => h === g.href);
        if (!can(g.perm)) expect(shown, `${role} must not see ${g.href}`).toBeFalsy();
      }
      if (!me.user.isSuperAdmin) expect(hrefs).not.toContain('/admin/organizations');

      // Forbidden route typed directly → bounced to dashboard
      const forbidden = GUARDED.find((g) => !can(g.perm));
      if (forbidden) {
        await page.goto(forbidden.href);
        await expect(page).toHaveURL(/\/(pattern)?$/);
      }

      for (const href of hrefs) {
        problems.clear();
        await clickSidebarLink(page, href);
        const [path] = href.split('?');
        await expect(page, `navigate ${href}`).toHaveURL(new RegExp(path === '/' ? '/$' : path.replace(/\//g, '\\/')));
        await expectPageRendered(page, `${role} ${href}`);
        // Breadcrumb (desktop) names the current page
        await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toBeVisible();
        await expectNoHorizontalOverflow(page, `${role} ${href}`);
        problems.assertNone();
      }
      await context.close();
    });
  });
}

test.describe('Shell interactions (admin)', () => {
  test('breadcrumbs, collapse persistence, command palette, avatar menu', async ({ browser, request }) => {
    const { context, page, problems } = await loginAs(browser, request, 'admin');
    await page.goto('/warehouse/stock-locator');
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs).toContainText('Stock');
    await expect(crumbs).toContainText('Warehouse');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Find stock');
    // Parent crumb links to first child
    await crumbs.getByRole('link', { name: 'Warehouse' }).click();
    await expect(page).toHaveURL(/\/warehouse\/warehouses$/);

    // Collapse → persists over reload → expand
    const shell = page.locator('.erp-shell-with-sidebar');
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(shell).toHaveAttribute('data-collapsed', 'true');
    await page.reload();
    await expect(shell).toHaveAttribute('data-collapsed', 'true');
    // Rail links still navigate (tooltip/aria-label)
    await page.locator('aside[aria-label="Sidebar"]').getByRole('link', { name: 'Approvals', exact: true }).click();
    await expect(page).toHaveURL(/\/approvals$/);
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(shell).toHaveAttribute('data-collapsed', 'false');
    await page.reload();
    await expect(shell).toHaveAttribute('data-collapsed', 'false');

    // Ctrl+K palette
    await page.goto('/');
    await expect(page.locator('#erp-main')).toBeVisible();
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    const input = palette.getByRole('combobox');
    await expect(input).toBeFocused();
    await input.fill('audit');
    await expect(palette.getByRole('option').first()).toContainText('Audit logs');
    await input.fill('zzzz-nothing');
    await expect(palette).toContainText('No pages or actions match');
    await input.fill('vendors');
    await input.press('Enter');
    await expect(palette).toBeHidden();
    await expect(page).toHaveURL(/\/vendors$/);
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    // Search button opens it too
    await page.getByRole('button', { name: 'Search pages and actions' }).first().click();
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');

    // Avatar menu → My account
    await page.getByRole('button', { name: /Account menu for/ }).click();
    await page.getByRole('menuitem', { name: 'My account' }).click();
    await expect(page).toHaveURL(/\/settings\/account$/);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('My account');
    problems.assertNone();
    await context.close();
  });

  test('notifications bell: list, mark read, deep link', async ({ browser, request }) => {
    const { context, page, session, problems } = await loginAs(browser, request, 'admin');
    const a = api(request, session);
    await page.goto('/');
    const bell = page.getByRole('button', { name: /^Notifications/ });
    const before = (await a.get('/notifications/unread-count')).count as number;
    expect(before, 'seed has unread notifications').toBeGreaterThan(0);
    await bell.click();
    await expect(page.getByRole('link', { name: 'View all notifications' })).toBeVisible();
    // Deep link: a design notification opens that design (not the dashboard)
    const recent = (await a.get('/notifications/recent', { limit: 8 })) as Array<{ _id: string; status: string; title: string; referenceType: string; referenceId: string; eventType: string }>;
    const expectedUrl = (x: (typeof recent)[number]): RegExp | null => {
      if (x.referenceType === 'DESIGN' && x.eventType === 'pattern.completed') return new RegExp(`/samples\\?designId=${x.referenceId}&from=pattern$`);
      if (x.referenceType === 'DESIGN') return new RegExp(`/designs/${x.referenceId}/edit$`);
      if (x.referenceType === 'SAMPLE') return new RegExp(`/samples\\?sampleId=${x.referenceId}$`);
      if (x.referenceType === 'GOODS_RECEIPT') return /\/purchase\?tab=grn$/;
      if (x.referenceType === 'APPROVAL') return /\/approvals$/;
      return null;
    };
    const n = recent.find((x) => x.status === 'UNREAD' && expectedUrl(x));
    expect(n, 'an unread deep-linkable notification in the bell').toBeTruthy();
    // Titles repeat across notifications; click the row whose position matches.
    await page.locator('ul li button').filter({ hasText: n!.title }).nth(
      recent.filter((x) => x.title === n!.title).findIndex((x) => x._id === n!._id),
    ).click();
    await expect(page).toHaveURL(expectedUrl(n!)!);
    await expect.poll(async () => (await a.get('/notifications/unread-count')).count as number).toBeLessThan(before);
    await expectPageRendered(page, 'notification deep link');
    // Design notifications link to /designs/:id/edit; the short /designs/:id form must not fall to the dashboard
    const designs = await a.get('/designs', { limit: 1 });
    const designId = (Array.isArray(designs) ? designs : designs.items || designs.data)[0]._id as string;
    await page.goto(`/designs/${designId}`);
    await expect(page).toHaveURL(new RegExp(`/designs/${designId}/edit$`));
    await expectPageRendered(page, 'design deep link');
    // Mark all read from the bell
    await bell.click();
    await page.getByRole('button', { name: 'Mark all read' }).click();
    await expect.poll(async () => (await a.get('/notifications/unread-count')).count as number).toBe(0);
    await page.getByRole('link', { name: 'View all notifications' }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    problems.assertNone();
    await context.close();
  });

  test('chat panel opens and closes', async ({ browser, request }) => {
    const { context, page, problems } = await loginAs(browser, request, 'admin');
    await page.goto('/');
    await page.getByRole('button', { name: /^Messages/ }).first().click();
    const chat = page.getByRole('dialog', { name: 'Messages' });
    await expect(chat).toBeVisible();
    await chat.getByRole('button', { name: 'Close messages' }).click();
    await expect(chat).toBeHidden();
    problems.assertNone();
    await context.close();
  });

  test('factory switcher lists the user factories', async ({ browser, request }) => {
    const { context, page, session, problems } = await loginAs(browser, request, 'admin');
    const me = await api(request, session).get('/users/me');
    await page.goto('/');
    if (me.factories.length > 1) {
      const sel = page.getByLabel('Active factory');
      await expect(sel).toBeVisible();
      const other = me.factories.find((f: { _id: string }) => f._id !== session.factoryId);
      await sel.selectOption(other._id);
      await expect.poll(() => page.evaluate(() => localStorage.getItem('factoryId'))).toBe(other._id);
      await expect(page.locator('#erp-main')).toBeVisible();
    } else {
      await expect(page.locator('header.erp-header-bar')).toContainText(me.factories[0].name);
    }
    problems.assertNone();
    await context.close();
  });

  test('sign out returns to /login and protected routes redirect', async ({ browser, request }) => {
    const { context, page, problems } = await loginAs(browser, request, 'admin');
    await page.goto('/users');
    await expect(page.locator('#erp-main')).toBeVisible();
    await page.getByRole('button', { name: /Account menu for/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
    await page.goto('/approvals');
    await expect(page).toHaveURL(/\/login$/);
    problems.assertNone();
    await context.close();
  });

  test('sign out still works when the session already expired server-side', async ({ browser, request }) => {
    const { context, page, problems } = await loginAs(browser, request, 'admin');
    await page.goto('/');
    await expect(page.locator('#erp-main')).toBeVisible();
    // Corrupt the token in-place: logout API call will 401 / fail; UI must still sign out.
    await page.evaluate(() => localStorage.setItem('accessToken', 'garbage'));
    await page.getByRole('button', { name: /Account menu for/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    problems.assertNone([/console:/]);
    await context.close();
  });
});

test.describe('Mobile shell (375x812)', () => {
  for (const role of ['admin', 'store', 'qc'] as RoleKey[]) {
    test(`hamburger drawer + no horizontal overflow (${role})`, async ({ browser, request }) => {
      test.setTimeout(240_000);
      const session = await apiLogin(request, role);
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
      await context.addInitScript(([token, factoryId]) => {
        if (!sessionStorage.getItem('__e2e_seeded')) {
          localStorage.setItem('accessToken', token);
          localStorage.setItem('factoryId', factoryId);
          sessionStorage.setItem('__e2e_seeded', '1');
        }
      }, [session.accessToken, session.factoryId]);
      const page = await context.newPage();
      const problems = watchProblems(page);
      await page.goto('/');
      await expectPageRendered(page, `mobile ${role} /`);
      await expectNoHorizontalOverflow(page, `mobile ${role} /`);

      await page.getByRole('button', { name: 'Open navigation' }).click();
      const drawer = page.getByRole('dialog', { name: 'Navigation' });
      await expect(drawer).toBeVisible();
      const closed = drawer.locator('button.erp-nav-dropdown-trigger[aria-expanded="false"]');
      while (await closed.count()) await closed.first().click();
      const hrefs = await drawer.locator('nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''));
      await drawer.getByRole('button', { name: 'Close menu' }).click();
      await expect(drawer).toBeHidden();

      for (const href of hrefs) {
        problems.clear();
        await page.getByRole('button', { name: 'Open navigation' }).click();
        await expect(drawer).toBeVisible();
        const c = drawer.locator('button.erp-nav-dropdown-trigger[aria-expanded="false"]');
        while (await c.count()) await c.first().click();
        await drawer.locator(`nav a[href="${href}"]`).first().click();
        await expect(drawer, `drawer closes after ${href}`).toBeHidden();
        await expectPageRendered(page, `mobile ${role} ${href}`);
        await expectNoHorizontalOverflow(page, `mobile ${role} ${href}`);
        problems.assertNone();
      }
      await context.close();
    });
  }
});

void API_URL; void USERS;
