import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * E2E helpers. Runs against a LOCAL stack only:
 *   frontend  PLAYWRIGHT_BASE_URL  (default http://localhost:5310)
 *   backend   E2E_API_URL          (default http://localhost:3310/api/v1, in-memory demo DB)
 * Never point these at production.
 */
export const API_URL = process.env.E2E_API_URL || 'http://localhost:3310/api/v1';

/** Seeded demo accounts (backend/src/config/systemRoles.js DEMO_USERS). */
export const USERS = {
  admin: { email: 'admin@demo.local', password: 'FactoryAdmin@123' },
  superAdmin: { email: 'superadmin@erp.local', password: 'SuperAdmin@123' },
  designer: { email: 'designer@demo.local', password: 'Demo@123' },
  designManager: { email: 'design-manager@demo.local', password: 'Demo@123' },
  pattern: { email: 'pattern@demo.local', password: 'Demo@123' },
  sampling: { email: 'sampling@demo.local', password: 'Demo@123' },
  planner: { email: 'planner@demo.local', password: 'Demo@123' },
  productionManager: { email: 'production-manager@demo.local', password: 'Demo@123' },
  store: { email: 'storekeeper@demo.local', password: 'Demo@123' },
  purchase: { email: 'purchase@demo.local', password: 'Demo@123' },
  finance: { email: 'finance-admin@demo.local', password: 'Demo@123' },
  warehouse: { email: 'warehouse@demo.local', password: 'Demo@123' },
  inventory: { email: 'inventory@demo.local', password: 'Demo@123' },
  qc: { email: 'qc@demo.local', password: 'Demo@123' },
  operator: { email: 'operator@demo.local', password: 'Demo@123' },
  auditor: { email: 'auditor@demo.local', password: 'Demo@123' },
} as const;
export type RoleKey = keyof typeof USERS;

export interface Session {
  accessToken: string;
  factoryId: string;
  userId: string;
}

export async function apiLogin(request: APIRequestContext, role: RoleKey): Promise<Session> {
  const res = await request.post(`${API_URL}/auth/login`, { data: USERS[role] });
  const body = await res.json();
  expect(body.success, `login ${role}: ${body?.error?.message}`).toBeTruthy();
  return {
    accessToken: body.data.accessToken,
    factoryId: body.data.factories?.[0]?._id,
    userId: body.data.user?._id,
  };
}

/** Thin API client for test setup/assertions (prefer driving the UI for the flow itself). */
export function api(request: APIRequestContext, s: Session) {
  const headers = { Authorization: `Bearer ${s.accessToken}`, 'X-Factory-Id': s.factoryId };
  const unwrap = async (res: Awaited<ReturnType<APIRequestContext['get']>>) => {
    const body = await res.json();
    if (!body.success) throw new Error(`${res.url()} → ${body?.error?.message || res.status()}`);
    return body.data;
  };
  return {
    get: async (path: string, params?: Record<string, string | number | boolean>) =>
      unwrap(await request.get(`${API_URL}${path}`, { headers, params })),
    post: async (path: string, data?: unknown) => unwrap(await request.post(`${API_URL}${path}`, { headers, data })),
    put: async (path: string, data?: unknown) => unwrap(await request.put(`${API_URL}${path}`, { headers, data })),
    patch: async (path: string, data?: unknown) => unwrap(await request.patch(`${API_URL}${path}`, { headers, data })),
  };
}

/**
 * A browser context logged in as `role`. Each role gets its own context, so roles never
 * overwrite each other's localStorage session.
 */
export async function loginAs(browser: Browser, request: APIRequestContext, role: RoleKey) {
  const session = await apiLogin(request, role);
  return openSession(browser, session);
}

/**
 * Raw password login for arbitrary (e.g. test-created) accounts. Returns the API body without
 * asserting, so callers can check that a login is refused (locked / inactive / wrong password).
 */
export async function apiLoginWith(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${API_URL}/auth/login`, { data: { email, password } });
  const body = await res.json();
  return { ok: !!body.success, status: res.status(), body };
}

/** Log in an arbitrary account (must succeed) and return a Session. */
export async function apiLoginAs(request: APIRequestContext, email: string, password: string): Promise<Session> {
  const r = await apiLoginWith(request, email, password);
  expect(r.ok, `login ${email}: ${r.body?.error?.message}`).toBeTruthy();
  return {
    accessToken: r.body.data.accessToken,
    factoryId: r.body.data.factories?.[0]?._id,
    userId: r.body.data.user?._id,
  };
}

/** Browser context seeded with an existing API session (optionally a custom viewport). */
export async function openSession(
  browser: Browser,
  session: Session,
  opts: { viewport?: { width: number; height: number }; mobile?: boolean } = {},
) {
  const context: BrowserContext = await browser.newContext({
    viewport: opts.viewport || { width: 1440, height: 900 },
    ...(opts.mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  await context.addInitScript(([token, factoryId]) => {
    if (!sessionStorage.getItem('__e2e_seeded')) {
      localStorage.setItem('accessToken', token);
      if (factoryId) localStorage.setItem('factoryId', factoryId);
      sessionStorage.setItem('__e2e_seeded', '1');
    }
  }, [session.accessToken, session.factoryId || ''] as const);
  const page = await context.newPage();
  const problems = watchProblems(page);
  return { context, page, session, problems };
}

/**
 * Like `loginAs`, but the password login runs through the browser context's own request client,
 * so the httpOnly `refreshToken` cookie lands in the context's cookie jar — exactly as after a
 * real sign-in. Needed for anything that exercises the silent refresh (frontend/src/services/api.ts).
 * Accepts a seeded role key or explicit credentials.
 */
export async function loginWithRefreshCookie(
  browser: Browser,
  who: RoleKey | { email: string; password: string },
  opts: { viewport?: { width: number; height: number } } = {},
) {
  const creds = typeof who === 'string' ? USERS[who] : who;
  const context: BrowserContext = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 } });
  const deviceId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await context.request.post(`${API_URL}/auth/login`, { data: creds, headers: { 'x-device-id': deviceId } });
  const body = await res.json();
  expect(body.success, `login ${creds.email}: ${body?.error?.message}`).toBeTruthy();
  const session: Session = {
    accessToken: body.data.accessToken,
    factoryId: body.data.factories?.[0]?._id,
    userId: body.data.user?._id,
  };
  const cookies = await context.cookies(API_URL);
  expect(cookies.some((c) => c.name === 'refreshToken'), 'refresh cookie stored in the browser context').toBeTruthy();
  await context.addInitScript(([token, factoryId, device]) => {
    if (!sessionStorage.getItem('__e2e_seeded')) {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('erp-device-id', device);
      if (factoryId) localStorage.setItem('factoryId', factoryId);
      sessionStorage.setItem('__e2e_seeded', '1');
    }
  }, [session.accessToken, session.factoryId || '', deviceId] as const);
  const page = await context.newPage();
  const problems = watchProblems(page);
  return { context, page, session, problems };
}

/**
 * Collect uncaught page errors, console errors and error toasts. Call `problems.assertNone()`
 * at the end of a step; pass `allow` regexes for errors the step deliberately triggers.
 */
export function watchProblems(page: Page) {
  const items: string[] = [];
  page.on('pageerror', (e) => items.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Network failures are surfaced as toasts/assertions instead; ignore noise.
    if (/Failed to load resource|favicon|ERR_ABORTED|WebSocket/i.test(t)) return;
    items.push(`console: ${t}`);
  });
  // Any API error surfaced to the user as an error toast counts as a problem.
  void page.exposeBinding('__e2eErrorToast', (_src, text: string) => items.push(`error toast: ${text}`)).catch(() => {});
  void page.addInitScript(() => {
    const seen = new WeakSet<Element>();
    new MutationObserver(() => {
      document.querySelectorAll('.erp-toast[role="alert"]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        (window as unknown as { __e2eErrorToast?: (t: string) => void }).__e2eErrorToast?.((el as HTMLElement).innerText);
      });
    }).observe(document, { childList: true, subtree: true });
  }).catch(() => {});
  return {
    items,
    clear: () => items.splice(0, items.length),
    assertNone: (allow: RegExp[] = []) => {
      const bad = items.filter((i) => !allow.some((r) => r.test(i)));
      expect(bad, bad.join('\n')).toEqual([]);
    },
  };
}

/** Wait for a toast containing `text` (success or info). */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first()).toBeVisible({ timeout: 10_000 });
}

/** Error toasts render as `.erp-toast[role="alert"]`. */
export const errorToast = (page: Page) => page.locator('.erp-toast[role="alert"]');

/** Fail fast if an error toast is showing. */
export async function expectNoErrorToast(page: Page) {
  const err = errorToast(page);
  if (await err.count()) {
    throw new Error(`Error toast shown: ${await err.first().innerText()}`);
  }
}

export function uniq(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
