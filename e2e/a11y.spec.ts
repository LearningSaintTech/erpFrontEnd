import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { api, loginAs, type RoleKey } from './helpers';

/**
 * Accessibility audit (WCAG 2.1 A/AA via axe-core) of every sidebar route per role plus key UI
 * states (drawer, modal, confirm dialog, command palette, dropdown menu, mobile nav), and a
 * keyboard-only walkthrough. Fails on any serious/critical violation that is not listed in
 * ALLOWED (each exception must carry a justification).
 *
 * A JSON report of every violation (all impacts) is written to test-results/a11y/<scope>.json.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['serious', 'critical']);

/**
 * Documented, justified exceptions. `rule` = axe rule id, `target` matches the node's CSS selector.
 * Keep this list short — fix the component instead whenever possible.
 */
// Currently empty: the audited routes and states have zero axe violations of any impact.
// Example entry: { rule: 'svg-img-alt', target: /recharts/, why: 'third-party chart internals; data also in a table' }
const ALLOWED: Array<{ rule: string; target: RegExp; why: string }> = [];

interface Finding { scope: string; url: string; rule: string; impact: string; help: string; targets: string[] }
const REPORT_DIR = process.env.A11Y_REPORT_DIR || path.join(process.cwd(), 'test-results', 'a11y');

function save(scope: string, findings: Finding[]) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, `${scope.replace(/[^\w-]+/g, '_')}.json`), JSON.stringify(findings, null, 2));
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.locator('.erp-skeleton, [aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
}

/** Run axe on the current page; returns findings (all impacts). */
async function audit(page: Page, scope: string, label: string): Promise<Finding[]> {
  await settle(page);
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return res.violations.flatMap((v) => {
    const targets = v.nodes
      .map((n) => n.target.join(' '))
      .filter((t) => !ALLOWED.some((a) => a.rule === v.id && a.target.test(t)));
    if (!targets.length) return [];
    return [{ scope, url: label, rule: v.id, impact: v.impact || 'minor', help: v.help, targets: targets.slice(0, 8) }];
  });
}

function assertNoBlocking(findings: Finding[]) {
  const bad = findings.filter((f) => BLOCKING.has(f.impact));
  const msg = bad.map((f) => `[${f.impact}] ${f.rule} @ ${f.url}: ${f.help}\n    ${f.targets.join('\n    ')}`).join('\n');
  expect(bad, msg).toEqual([]);
}

/**
 * Navigate and wait for the app shell. Other people may be editing source files while the dev
 * server runs (HMR can briefly blank the page), so retry once with a reload.
 */
async function gotoApp(page: Page, href: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(href);
    try {
      await page.locator('#erp-main').waitFor({ state: 'visible', timeout: 15_000 });
      return;
    } catch { /* retry */ }
  }
  await expect(page.locator('#erp-main')).toBeVisible();
}

/** Every href in the desktop sidebar (dropdown parents expanded). */
async function sidebarHrefs(page: Page): Promise<string[]> {
  const sidebar = page.locator('aside[aria-label="Sidebar"]');
  const closed = sidebar.locator('button.erp-nav-dropdown-trigger[aria-expanded="false"]');
  while (await closed.count()) await closed.first().click();
  return sidebar.locator('nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''));
}

test('a11y: login page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const findings = await audit(page, 'login', '/login');
  save('login', findings);
  assertNoBlocking(findings);
});

const ROLES: RoleKey[] = ['admin', 'designer', 'store', 'operator'];

for (const role of ROLES) {
  test(`a11y: every sidebar route (${role})`, async ({ browser, request }) => {
    test.setTimeout(600_000);
    const { context, page, session } = await loginAs(browser, request, role);
    await gotoApp(page, '/');
    await settle(page);
    const hrefs = [...new Set(await sidebarHrefs(page))];
    const extra = ['/settings/account'];
    if (role === 'admin') {
      const designs = await api(request, session).get('/designs', { limit: 1 });
      const list = Array.isArray(designs) ? designs : designs.items || designs.data;
      if (list?.[0]?._id) extra.push(`/designs/${list[0]._id}/edit`);
    }
    const findings: Finding[] = [];
    for (const href of [...hrefs, ...extra]) {
      await gotoApp(page, href);
      findings.push(...(await audit(page, role, href)));
      save(`routes-${role}`, findings);
    }
    save(`routes-${role}`, findings);
    assertNoBlocking(findings);
    await context.close();
  });
}

test('a11y: overlays and menus (admin)', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { context, page } = await loginAs(browser, request, 'admin');
  const findings: Finding[] = [];

  // Drawer form
  await gotoApp(page, '/vendors');
  await settle(page);
  await page.getByRole('button', { name: 'New vendor' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  findings.push(...(await audit(page, 'states', 'drawer: new vendor')));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  // Drawer with search-selects (purchase requisition)
  await gotoApp(page, '/purchase');
  await settle(page);
  await page.getByRole('button', { name: 'New requisition' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  findings.push(...(await audit(page, 'states', 'drawer: new requisition')));
  // Search-select (material picker) open inside the drawer, operated by keyboard
  const picker = page.getByRole('dialog').getByRole('button', { name: /Search code or name|Material/ }).first();
  await picker.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter options' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  findings.push(...(await audit(page, 'states', 'search select open')));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(picker).toBeFocused();
  await page.keyboard.press('Escape');

  // Row dropdown menu + confirm dialog
  await gotoApp(page, '/vendors');
  await settle(page);
  await page.getByRole('button', { name: /More actions|Actions for/ }).first().click();
  await expect(page.getByRole('menu')).toBeVisible();
  findings.push(...(await audit(page, 'states', 'row actions menu')));
  const deactivate = page.getByRole('menuitem', { name: /Deactivate/ });
  if (await deactivate.count()) {
    await deactivate.click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    findings.push(...(await audit(page, 'states', 'confirm dialog')));
    await page.keyboard.press('Escape');
  } else {
    await page.keyboard.press('Escape');
  }

  // Modal (chat: new group)
  await gotoApp(page, '/chat');
  await settle(page);
  await page.getByRole('button', { name: 'New group' }).first().click();
  await expect(page.getByRole('dialog', { name: 'New group' })).toBeVisible();
  findings.push(...(await audit(page, 'states', 'modal: new group')));
  await page.keyboard.press('Escape');

  // Command palette + account dropdown
  await gotoApp(page, '/');
  await settle(page);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  findings.push(...(await audit(page, 'states', 'command palette')));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Account menu for/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  findings.push(...(await audit(page, 'states', 'account menu')));
  await page.keyboard.press('Escape');
  await context.close();

  // Mobile nav at 375px
  const mobile = await loginAs(browser, request, 'admin');
  await mobile.page.setViewportSize({ width: 375, height: 812 });
  await gotoApp(mobile.page, '/');
  await settle(mobile.page);
  findings.push(...(await audit(mobile.page, 'states', 'mobile dashboard')));
  await mobile.page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(mobile.page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
  findings.push(...(await audit(mobile.page, 'states', 'mobile nav')));
  await mobile.context.close();

  save('states', findings);
  assertNoBlocking(findings);
});

test.describe('keyboard only', () => {
  test('tab through a list page, open/close a drawer, dropdown menu, command palette', async ({ browser, request }) => {
    const { context, page } = await loginAs(browser, request, 'admin');
    await gotoApp(page, '/vendors');
    await settle(page);

    // Skip link is the first tab stop and moves focus to main
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#erp-main')).toBeFocused();

    // Tabbing forward from main reaches the "New vendor" button; every stop shows a focus ring
    let reached = false;
    for (let i = 0; i < 40 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          text: (el.getAttribute('aria-label') || el.innerText || '').trim(),
          ring: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none',
        };
      });
      expect(info, 'focus must stay on an element').not.toBeNull();
      expect(info!.ring, `visible focus indicator on "${info!.text}"`).toBeTruthy();
      if (/^New vendor$/.test(info!.text)) reached = true;
    }
    expect(reached, 'New vendor reachable by Tab').toBeTruthy();

    // Open drawer with Enter; focus moves inside; Tab stays trapped; Esc closes & restores focus
    await page.evaluate(() => document.activeElement?.setAttribute('data-kbd-opener', ''));
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBeTruthy();
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate((d) => d.contains(document.activeElement)), 'focus trapped in drawer').toBeTruthy();
    }
    await page.keyboard.press('Shift+Tab');
    expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.locator('[data-kbd-opener]')).toBeFocused();

    // Dropdown menu: focus trigger, open with Enter, arrows move, Esc closes back to trigger
    const trigger = page.getByRole('button', { name: /Account menu for/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(page.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    // Command palette: open, type, arrow, Enter navigates
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette.getByRole('combobox')).toBeFocused();
    await page.keyboard.type('inventory');
    await page.keyboard.press('Enter');
    await expect(palette).toBeHidden();
    await expect(page).toHaveURL(/\/inventory/);
    await context.close();
  });
});
