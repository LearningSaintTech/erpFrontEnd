# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-flow.spec.ts >> Dashboard: attention cards deep-link, KPIs and period selector (admin + roles)
- Location: e2e\admin-flow.spec.ts:22:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('link', { name: /Approvals for you/ }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('link', { name: /Approvals for you/ }).first()

```

```yaml
- link "Skip to content":
  - /url: "#erp-main"
- complementary "Sidebar":
  - link "ERP Factory — dashboard":
    - /url: /
    - text: EF ERP Factory Factory workspace
  - navigation "Main":
    - list:
      - listitem:
        - link "Dashboard":
          - /url: /
      - listitem:
        - link "Approvals":
          - /url: /approvals
    - paragraph: Develop
    - list:
      - listitem:
        - link "Designs":
          - /url: /designs
      - listitem:
        - link "Patterns":
          - /url: /pattern
      - listitem:
        - link "Samples":
          - /url: /samples
    - paragraph: Products
    - list:
      - listitem:
        - link "SKUs":
          - /url: /products/skus
      - listitem:
        - link "BOMs":
          - /url: /products/boms
    - paragraph: Procure
    - list:
      - listitem:
        - link "Purchase":
          - /url: /purchase
      - listitem:
        - link "Vendors":
          - /url: /vendors
    - paragraph: Stock
    - list:
      - listitem:
        - link "Inventory":
          - /url: /inventory
      - listitem:
        - button "Warehouse"
    - paragraph: Make
    - list:
      - listitem:
        - link "Production orders":
          - /url: /production/orders
      - listitem:
        - link "Machines & capacity":
          - /url: /production/machines
      - listitem:
        - link "Waste":
          - /url: /waste
    - paragraph: Quality
    - list:
      - listitem:
        - link "Inspections":
          - /url: /quality/inspections
      - listitem:
        - link "CAPA":
          - /url: /quality/capa
      - listitem:
        - link "Templates":
          - /url: /quality/templates
    - paragraph: Insights
    - list:
      - listitem:
        - link "Reports":
          - /url: /reports/factory
      - listitem:
        - link "Notifications":
          - /url: /notifications
      - listitem:
        - link "Messages":
          - /url: /chat
    - paragraph: Administration
    - list:
      - listitem:
        - link "Users & roles":
          - /url: /users
      - listitem:
        - link "Approval workflows":
          - /url: /approvals?tab=workflows
      - listitem:
        - link "Settings":
          - /url: /settings
      - listitem:
        - link "Factory settings":
          - /url: /settings/factory-settings
      - listitem:
        - link "Inventory codes":
          - /url: /settings/inventory-codes
      - listitem:
        - link "Audit logs":
          - /url: /audit
  - button "Collapse sidebar": Collapse
- banner:
  - navigation "Breadcrumb":
    - list:
      - listitem: Dashboard
  - button "Search pages and actions": Search… Ctrl K
  - text: Main Production Unit
  - button "Messages"
  - button "Notifications, 17 unread": 9+
  - button "Account menu for Factory Admin": FA
- main:
  - heading "Good morning, Factory" [level=1]
  - paragraph: Here is what needs attention at Main Production Unit today.
  - combobox "Period":
    - option "Month to date" [selected]
    - option "Last 7 days"
    - option "Last 30 days"
    - option "Last 90 days"
    - option "Year to date"
    - option "All time"
  - button "Refresh dashboard" [disabled]
  - button "Full reports"
  - heading "Needs your attention" [level=3]
  - paragraph: Checking your queues…
  - status "Loading"
  - heading "Key numbers" [level=2]
  - text: Month to date
  - tablist "Dashboard views":
    - tab "Overview" [selected]
    - tab "Production"
    - tab "Supply chain"
    - tab "Quality"
  - heading "Fulfillment rate" [level=3]
  - link "View":
    - /url: /production/orders
  - paragraph: No production orders yet
  - paragraph: Fulfillment is measured once production orders exist for this period.
  - heading "Production orders" [level=3]
  - paragraph: By status
  - link "View":
    - /url: /production/orders
  - paragraph: No production orders
  - paragraph: Orders created in this period will be charted here.
  - heading "Design pipeline" [level=3]
  - paragraph: Designs by status
  - link "View":
    - /url: /designs
  - paragraph: No designs yet
  - paragraph: Designs appear here once they are created.
  - heading "Low stock" [level=3]
  - link "View all":
    - /url: /inventory?tab=alerts
  - paragraph: Stock levels look healthy
  - paragraph: Materials appear here when they drop to their reorder level.
  - heading "Recent activity" [level=3]
  - paragraph: Latest production orders and supplier payments.
  - link "Production":
    - /url: /production/orders
  - link "Payments":
    - /url: /purchase?tab=po
  - table:
    - rowgroup:
      - row "Reference Type Qty / value Status Date":
        - columnheader "Reference"
        - columnheader "Type"
        - columnheader "Qty / value"
        - columnheader "Status"
        - columnheader "Date"
    - rowgroup:
      - row "No recent orders New production orders and payments will show up here.":
        - cell "No recent orders New production orders and payments will show up here.":
          - paragraph: No recent orders
          - paragraph: New production orders and payments will show up here.
- region "Notifications"
- button "Open messages"
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import {
  3   |   api, apiLogin, apiLoginAs, apiLoginWith, expectToast, loginAs, openSession, uniq,
  4   | } from './helpers';
  5   | 
  6   | /**
  7   |  * Administration flows driven through the UI: dashboard, approvals, users & roles, settings,
  8   |  * audit, reports, notifications and the super-admin organizations page.
  9   |  * API calls are only used for setup and assertions.
  10  |  */
  11  | 
  12  | /** A modal/drawer/confirm by its title text. */
  13  | const dialog = (page: Page, title: string | RegExp) =>
  14  |   page.locator('[role="dialog"], [role="alertdialog"]').filter({ has: page.getByText(title, { exact: false }) }).last();
  15  | 
  16  | async function settle(page: Page) {
  17  |   await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  18  | }
  19  | 
  20  | // ─────────────────────────────── Dashboard ───────────────────────────────
  21  | 
  22  | test('Dashboard: attention cards deep-link, KPIs and period selector (admin + roles)', async ({ browser, request }) => {
  23  |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  24  |   await page.goto('/');
  25  |   await settle(page);
  26  |   const attention = page.locator('#erp-main');
  27  |   await expect(page.getByRole('heading', { name: 'Needs your attention' })).toBeVisible({ timeout: 30_000 });
  28  |   await expect(attention).not.toContainText('Checking your queues', { timeout: 15_000 });
  29  | 
  30  |   const cards: Array<{ label: string; url: RegExp }> = [
  31  |     { label: 'Approvals for you', url: /\/approvals\?tab=inbox$/ },
  32  |     { label: 'QC queue', url: /\/quality\/inspections\?tab=queue$/ },
  33  |     { label: 'Goods receipts to inspect', url: /\/quality\/inspections\?tab=incoming$/ },
  34  |     { label: 'Low stock materials', url: /\/inventory\?tab=alerts$/ },
  35  |     { label: 'Unpaid payments', url: /\/purchase\?tab=po$/ },
  36  |   ];
  37  |   for (const c of cards) {
  38  |     problems.clear();
  39  |     await page.goto('/');
  40  |     const link = page.getByRole('link', { name: new RegExp(c.label) }).first();
> 41  |     await expect(link).toBeVisible();
      |                        ^ Error: expect(locator).toBeVisible() failed
  42  |     await link.click();
  43  |     await expect(page, `${c.label} deep link`).toHaveURL(c.url);
  44  |     await settle(page);
  45  |     if (c.label === 'Approvals for you') await expect(page.getByRole('tab', { name: /Inbox/ })).toHaveAttribute('aria-selected', 'true');
  46  |     if (c.label === 'Low stock materials') await expect(page.getByRole('tab', { name: /^Alerts/ })).toHaveAttribute('aria-selected', 'true');
  47  |     problems.assertNone();
  48  |   }
  49  | 
  50  |   // KPI tiles + period selector
  51  |   await page.goto('/');
  52  |   await settle(page);
  53  |   const period = page.getByLabel('Period');
  54  |   await expect(period).toBeVisible();
  55  |   const options = await period.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  56  |   expect(options.length).toBeGreaterThan(1);
  57  |   for (const v of options) {
  58  |     problems.clear();
  59  |     await period.selectOption(v);
  60  |     await settle(page);
  61  |     await expect(page.locator('#erp-main')).not.toContainText('NaN');
  62  |     problems.assertNone();
  63  |   }
  64  |   await context.close();
  65  | 
  66  |   // A couple of other roles: dashboard renders, no errors, cards only for their modules
  67  |   for (const role of ['store', 'qc', 'designer'] as const) {
  68  |     const s = await loginAs(browser, request, role);
  69  |     await s.page.goto('/');
  70  |     await settle(s.page);
  71  |     await expect(s.page.locator('#erp-main')).not.toContainText('NaN');
  72  |     if (role === 'designer') await expect(s.page.getByRole('link', { name: /Unpaid payments/ })).toHaveCount(0);
  73  |     if (role === 'qc') await expect(s.page.getByRole('link', { name: /QC queue/ })).toBeVisible();
  74  |     s.problems.assertNone();
  75  |     await s.context.close();
  76  |   }
  77  | });
  78  | 
  79  | // ─────────────────────────────── Approvals ───────────────────────────────
  80  | 
  81  | test('Approvals: approve, request changes, reject with required comment; drawer; history; deep links', async ({ browser, request }) => {
  82  |   const { context, page, session, problems } = await loginAs(browser, request, 'admin');
  83  |   const a = api(request, session);
  84  |   const pending = await a.get('/approvals/pending', { limit: 50 });
  85  |   type Item = { _id: string; documentType: string; documentSummary?: { code?: string }; submittedBy?: string | { _id: string } };
  86  |   // Separation of duties: the admin can't decide on documents they submitted themselves.
  87  |   const items = ((pending.items ?? pending) as Item[]).filter((i) => {
  88  |     const by = typeof i.submittedBy === 'object' ? i.submittedBy?._id : i.submittedBy;
  89  |     return by !== session.userId;
  90  |   });
  91  |   // The demo seed has 3 decidable items (2 designs + 1 PR). Decisions are permanent, so this test
  92  |   // needs a freshly seeded backend (restart the in-memory API between full runs).
  93  |   expect(items.length, 'decidable approvals in the seed — restart the in-memory backend to reseed').toBeGreaterThanOrEqual(3);
  94  |   const codes = items.map((i) => i.documentSummary!.code!);
  95  |   const [toApprove, toChange, toReject] = codes;
  96  | 
  97  |   await page.goto('/approvals');
  98  |   await settle(page);
  99  |   const row = (code: string) => page.locator('li').filter({ has: page.getByRole('button', { name: code, exact: true }) });
  100 | 
  101 |   // Detail drawer + history
  102 |   await row(toApprove).getByRole('button', { name: toApprove, exact: true }).click();
  103 |   const drawer = dialog(page, toApprove);
  104 |   await expect(drawer).toBeVisible();
  105 |   await expect(drawer).toContainText('Submitted by');
  106 |   await expect(drawer.getByRole('heading', { name: 'History' })).toBeVisible();
  107 |   await drawer.getByRole('button', { name: 'Close' }).last().click();
  108 |   await expect(drawer).toBeHidden();
  109 | 
  110 |   // Approve (comment optional)
  111 |   await row(toApprove).getByRole('button', { name: /^Approve/ }).click();
  112 |   const ap = dialog(page, `Approve ${toApprove}?`);
  113 |   await expect(ap).toBeVisible();
  114 |   await ap.getByRole('button', { name: 'Approve', exact: true }).click();
  115 |   await expectToast(page, `${toApprove} approved`);
  116 |   await expect(row(toApprove)).toHaveCount(0);
  117 | 
  118 |   // Request changes — comment required
  119 |   await row(toChange).getByRole('button', { name: 'Request changes' }).click();
  120 |   const rc = dialog(page, `Request changes on ${toChange}`);
  121 |   await rc.getByRole('button', { name: 'Send back' }).click();
  122 |   await expect(rc.getByRole('alert')).toBeVisible();
  123 |   await expect(rc).toBeVisible();
  124 |   await rc.getByRole('textbox').fill('Please fix the size chart.');
  125 |   await rc.getByRole('button', { name: 'Send back' }).click();
  126 |   await expectToast(page, `${toChange} sent back for changes`);
  127 | 
  128 |   // Reject via row menu — reason required
  129 |   await row(toReject).getByRole('button', { name: 'More actions' }).click();
  130 |   await page.getByRole('menuitem', { name: /Reject/ }).click();
  131 |   const rj = dialog(page, `Reject ${toReject}?`);
  132 |   await rj.getByRole('button', { name: 'Reject', exact: true }).click();
  133 |   await expect(rj.getByRole('alert')).toBeVisible();
  134 |   await rj.getByRole('textbox').fill('Duplicate request.');
  135 |   await rj.getByRole('button', { name: 'Reject', exact: true }).click();
  136 |   await expectToast(page, `${toReject} rejected`);
  137 |   problems.assertNone();
  138 | 
  139 |   // History tab + filters
  140 |   await page.getByRole('tab', { name: 'History' }).click();
  141 |   await expect(page).toHaveURL(/tab=history/);
```