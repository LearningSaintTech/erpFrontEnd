import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import { API_URL, apiLogin, openSession, type Session } from './helpers';

/**
 * Performance budget on the LARGE dataset (backend started with SEED_LARGE=true, see e2e/README.md):
 *   - every listed API (median of 3 after a warm-up) must answer in < 1 s
 *   - every main page must show its data in < 3 s (full navigation, warm module cache)
 * Timings are logged and written to test-results/perf/*.json.
 */

const API_BUDGET_MS = 1000;
const PAGE_BUDGET_MS = 3000;
const OUT = process.env.PERF_REPORT_DIR || path.join(process.cwd(), 'test-results', 'perf');

function write(name: string, data: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const ENDPOINTS: string[] = [
  // dashboard / stats
  '/reports/stats', '/reports/factory', '/reports/financial', '/reports/production', '/reports/purchase',
  '/reports/quality', '/reports/inventory', '/reports/waste', '/reports/approval', '/reports/employee', '/reports/machine',
  '/reports/drill-down/low-stock?page=1&limit=10', '/reports/drill-down/pending-approvals?page=1&limit=10',
  '/designs/stats', '/skus/stats', '/boms/stats', '/purchase/stats', '/inventory/stats', '/production/stats',
  '/quality/stats', '/quality/pending-work', '/approvals/stats', '/notifications/stats', '/notifications/unread-count',
  '/notifications/recent?limit=8', '/samples/stats', '/pattern-developments/stats', '/warehouse/stats', '/waste/stats',
  // approvals inbox
  '/approvals/pending?page=1&limit=50', '/approvals?status=ALL&page=1&limit=20', '/approvals?status=ALL&search=purchase&page=1&limit=20',
  // lists with search & filters
  '/designs?page=1&limit=20', '/designs?page=1&limit=20&search=Classic', '/designs?page=1&limit=20&status=APPROVED', '/designs?limit=200',
  '/skus?page=1&limit=20', '/skus?page=1&limit=20&search=LSKU-0001', '/skus?page=1&limit=20&status=ACTIVE',
  '/boms?page=1&limit=20', '/boms?page=1&limit=20&search=LBOM', '/boms?page=1&limit=20&status=ACTIVE',
  '/purchase-requisitions?page=1&limit=20', '/purchase-requisitions?page=1&limit=20&status=APPROVED&search=LPR-00',
  '/purchase-orders?page=1&limit=20', '/purchase-orders?page=1&limit=20&search=LPO&status=SENT',
  '/goods-receipts?page=1&limit=20', '/goods-receipts?page=1&limit=20&status=COMPLETED',
  '/suppliers?page=1&limit=20', '/suppliers?page=1&limit=20&search=Textiles',
  '/materials?page=1&limit=20', '/materials?page=1&limit=20&search=Cotton',
  '/inventory/balances?page=1&limit=20', '/inventory/balances?page=1&limit=20&search=Cotton',
  '/inventory/transactions?page=1&limit=20', '/inventory/transactions?page=1&limit=20&type=RECEIPT',
  '/production-orders?page=1&limit=20', '/production-orders?page=1&limit=20&status=IN_PROGRESS&search=LPRD',
  '/batches?page=1&limit=20', '/batches/board',
  '/quality-inspections?page=1&limit=20', '/quality-inspections/queue',
  '/notifications?page=1&limit=20', '/audit-logs?page=1&limit=20', '/audit-logs?page=1&limit=20&module=purchase',
  '/samples?page=1&limit=20', '/pattern-developments?page=1&limit=20', '/waste-records?page=1&limit=20',
];

const PAGES: string[] = [
  '/', '/approvals', '/designs', '/samples', '/pattern', '/products/skus', '/products/boms', '/purchase', '/vendors',
  '/inventory', '/warehouse/stock-locator', '/production/orders', '/quality/inspections', '/waste',
  '/reports/factory', '/notifications', '/audit',
];

let session: Session;

test.beforeAll(async ({ request }) => {
  session = await apiLogin(request, 'admin');
});

test('API response times on the large dataset', async ({ request }) => {
  test.setTimeout(600_000);
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-Factory-Id': session.factoryId };
  const time = async (url: string) => {
    const t = performance.now();
    const res = await request.get(`${API_URL}${url}`, { headers });
    const ms = performance.now() - t;
    return { ms, status: res.status() };
  };

  // MRP preview for a BOM with lines (large dataset BOMs are LBOM-*)
  const boms = await (await request.get(`${API_URL}/boms?page=1&limit=1&search=LBOM`, { headers })).json();
  const bomId = boms?.data?.[0]?._id ?? boms?.data?.items?.[0]?._id;
  const endpoints = bomId ? [...ENDPOINTS, `/boms/${bomId}/mrp-preview`] : ENDPOINTS;

  const rows: Array<{ endpoint: string; status: number; medianMs: number; samples: number[] }> = [];
  for (const ep of endpoints) {
    await time(ep); // warm-up
    const samples: number[] = [];
    let status = 0;
    for (let i = 0; i < 3; i += 1) {
      const r = await time(ep);
      samples.push(Math.round(r.ms));
      status = r.status;
    }
    rows.push({ endpoint: ep, status, medianMs: median(samples), samples });
  }
  rows.sort((a, b) => b.medianMs - a.medianMs);
  write('api.json', rows);
  console.log('\nAPI timings (median of 3, ms):');
  for (const r of rows) console.log(`${String(r.medianMs).padStart(6)}  ${r.status}  ${r.endpoint}`);

  const failed = rows.filter((r) => r.status >= 400);
  expect(failed.map((r) => `${r.status} ${r.endpoint}`), 'endpoints must succeed').toEqual([]);
  const slow = rows.filter((r) => r.medianMs > API_BUDGET_MS);
  expect(slow.map((r) => `${r.endpoint}: ${r.medianMs} ms`), `APIs over ${API_BUDGET_MS} ms`).toEqual([]);
});

/** Main area rendered, no skeletons, tables have real rows (or an empty state). */
async function waitForData(page: Page) {
  await page.waitForFunction(() => {
    const main = document.querySelector('#erp-main') as HTMLElement | null;
    if (!main) return false;
    if (main.querySelector('.erp-skeleton')) return false;
    if (/^\s*Loading/.test(main.innerText)) return false;
    if (main.innerText.trim().length < 50) return false;
    const tables = Array.from(main.querySelectorAll('table'));
    return tables.every((t) => t.querySelector('tbody tr:not([aria-hidden="true"])'));
  }, null, { polling: 50, timeout: 20_000 });
}

test('page load to data visible on the large dataset', async ({ browser }) => {
  test.setTimeout(600_000);
  const { context, page } = await openSession(browser, session);
  // Warm the dev server's module cache so we time data, not first-compile of source files.
  for (const href of PAGES) {
    await page.goto(href);
    await waitForData(page).catch(() => {});
  }

  const rows: Array<{ page: string; ms: number; slowestApi?: string; slowestApiMs?: number; apiCalls: number }> = [];
  for (const href of PAGES) {
    const apis: Array<{ url: string; ms: number }> = [];
    const onFinished = (req: import('@playwright/test').Request) => {
      if (!req.url().includes('/api/v1/')) return;
      const t = req.timing();
      if (t.responseEnd > 0) apis.push({ url: req.url().replace(/^.*\/api\/v1/, ''), ms: Math.round(t.responseEnd) });
    };
    page.on('requestfinished', onFinished);
    const t0 = performance.now();
    await page.goto(href);
    await waitForData(page);
    const ms = Math.round(performance.now() - t0);
    page.off('requestfinished', onFinished);
    const slowest = apis.sort((a, b) => b.ms - a.ms)[0];
    rows.push({ page: href, ms, slowestApi: slowest?.url, slowestApiMs: slowest?.ms, apiCalls: apis.length });
  }
  write('pages.json', rows);
  console.log('\nPage load → data visible (ms):');
  for (const r of rows) console.log(`${String(r.ms).padStart(6)}  ${r.page.padEnd(26)} slowest API ${r.slowestApiMs ?? '-'} ms ${r.slowestApi ?? ''}`);
  await context.close();

  const slow = rows.filter((r) => r.ms > PAGE_BUDGET_MS);
  expect(slow.map((r) => `${r.page}: ${r.ms} ms`), `pages over ${PAGE_BUDGET_MS} ms`).toEqual([]);
});
