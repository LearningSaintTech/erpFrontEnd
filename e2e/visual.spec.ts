import { test, expect, type Browser, type APIRequestContext, type Page, type Locator } from '@playwright/test';
import { api, apiLogin, type RoleKey } from './helpers';

/**
 * Visual-regression baselines for key pages at desktop (1440×900) and mobile (375×812).
 *
 * Deterministic by construction:
 *  - Date.now()/new Date() frozen with page.clock.setFixedTime (relative dates render the same)
 *  - reduced motion + animations disabled + caret hidden
 *  - waits for network idle, web fonts and skeletons to disappear
 *  - masks volatile regions: anything date/time-like, KPI values & counts, badges, avatars,
 *    toasts, the floating chat button
 *
 * Baselines are OS-specific (font rendering). See e2e/README.md for how to update them.
 * Expects the fresh in-memory demo seed (not the SEED_LARGE dataset).
 */

const FROZEN_NOW = new Date('2026-06-15T10:30:00+05:30');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 },
} as const;
type Vp = keyof typeof VIEWPORTS;

async function open(browser: Browser, request: APIRequestContext, vp: Vp, role: RoleKey | null) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[vp],
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    ...(vp === 'mobile' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { deviceScaleFactor: 1 }),
  });
  let session = null;
  if (role) {
    session = await apiLogin(request, role);
    await context.addInitScript(([token, factoryId]) => {
      if (!sessionStorage.getItem('__e2e_seeded')) {
        localStorage.setItem('accessToken', token);
        if (factoryId) localStorage.setItem('factoryId', factoryId);
        sessionStorage.setItem('__e2e_seeded', '1');
      }
    }, [session.accessToken, session.factoryId || ''] as const);
  }
  const page = await context.newPage();
  await page.clock.setFixedTime(FROZEN_NOW);
  return { context, page, session };
}

/** Navigate (retrying if HMR blanks the page) and wait until the page is visually settled. */
async function gotoStable(page: Page, href: string, ready: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(href);
    try {
      await page.locator(ready).first().waitFor({ state: 'visible', timeout: 15_000 });
      break;
    } catch { /* retry */ }
  }
  await expect(page.locator(ready).first()).toBeVisible();
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  await expect.poll(() => page.locator('#erp-main .erp-skeleton, .erp-skeleton:visible').count(), { timeout: 15_000 }).toBe(0);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  // Tag leaf elements whose text looks like a date/time/relative time so they can be masked.
  await page.evaluate(() => {
    const re = /(\b\d{1,2}[ -](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)|(\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}\b)|(\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b)|(\b\d{4}-\d{2}-\d{2}\b)|(\b\d{1,2}:\d{2}\b)|(\bago\b)|(\b(today|yesterday|tomorrow|overdue by|due in)\b)/i;
    document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
      if (el.children.length > 0 && !(el.children.length === 1 && el.children[0].tagName === 'SVG')) return;
      const t = el.innerText || '';
      if (t && t.length < 80 && re.test(t)) el.setAttribute('data-vr-mask', '');
    });
  });
}

function masks(page: Page): Locator[] {
  return [
    page.locator('[data-vr-mask]'),
    page.locator('time'),
    page.locator('.erp-kpi-value'),
    page.locator('.erp-nav-badge'),
    page.locator('.erp-tab-count, [class*="tab-count"]'),
    page.locator('[aria-label^="Account menu for"] span').first(),
    page.locator('.erp-toast'),
    page.locator('.chat-fab-btn'),
    page.locator('[aria-label^="Notifications"] span, [aria-label^="Messages"] span'),
    page.locator('.recharts-wrapper'),
  ];
}

async function snap(page: Page, name: string) {
  await expect(page).toHaveScreenshot(name, {
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
    mask: masks(page),
    maskColor: '#c8c8d0',
    maxDiffPixelRatio: 0.002,
  });
}

interface Shot { name: string; href: string | ((ids: { designId: string }) => string); ready: string; role?: RoleKey | null }

const SHOTS: Shot[] = [
  { name: 'login', href: '/login', ready: 'h1', role: null },
  { name: 'dashboard', href: '/', ready: '#erp-main h1' },
  { name: 'approvals-inbox', href: '/approvals', ready: '#erp-main h1' },
  { name: 'purchase', href: '/purchase', ready: '#erp-main table' },
  { name: 'inventory', href: '/inventory', ready: '#erp-main h1' },
  { name: 'production-orders', href: '/production/orders?tab=orders', ready: '#erp-main table' },
  { name: 'production-batch-board', href: '/production/orders?tab=board', ready: '#erp-main h1' },
  { name: 'quality', href: '/quality/inspections', ready: '#erp-main h1' },
  { name: 'designs', href: '/designs', ready: '#erp-main h1' },
  { name: 'design-record', href: ({ designId }) => `/designs/${designId}/edit`, ready: '#erp-main h1' },
  { name: 'samples', href: '/samples', ready: '#erp-main h1' },
  { name: 'settings', href: '/settings/general', ready: '#erp-main h1' },
];

for (const vp of Object.keys(VIEWPORTS) as Vp[]) {
  test.describe(`visual ${vp}`, () => {
    for (const shot of SHOTS) {
      test(`${shot.name} @${vp}`, async ({ browser, request }) => {
        const role = shot.role === undefined ? 'admin' : shot.role;
        const { context, page } = await open(browser, request, vp, role);
        let href = shot.href;
        if (typeof href === 'function') {
          const s = await apiLogin(request, 'admin');
          const res = await api(request, s).get('/designs', { limit: 50 });
          const list = (Array.isArray(res) ? res : res.items || res.data) as Array<{ _id: string; designCode: string }>;
          // Stable pick: lowest design code, not "most recent".
          const d = [...list].sort((a, b) => a.designCode.localeCompare(b.designCode))[0];
          href = href({ designId: d._id });
        }
        await gotoStable(page, href, shot.ready);
        await snap(page, `${shot.name}-${vp}.png`);
        await context.close();
      });
    }
  });
}
