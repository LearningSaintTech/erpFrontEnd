# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-flow.spec.ts >> Users: create with first role, edit, assign/remove role, reset password, lock/unlock, deactivate/activate
- Location: e2e\admin-flow.spec.ts:214:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[role="status"], [role="alert"]').filter({ hasText: 'User created' }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[role="status"], [role="alert"]').filter({ hasText: 'User created' }).first()

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
      - listitem: Administration
      - listitem: Users & roles
  - button "Search pages and actions": Search… Ctrl K
  - text: Main Production Unit
  - button "Messages"
  - button "Notifications, 18 unread": 9+
  - button "Account menu for Factory Admin": FA
- main:
  - heading "Users & roles" [level=1]
  - paragraph: Invite people, give them roles per factory, and control what each role can do.
  - button "New user"
  - paragraph: How access works
  - text: A role is a set of permissions (for example Designer). People get one or more roles at each factory. System roles are fixed; create custom roles when you need a different mix. Delegations lend permissions temporarily.
  - button "Dismiss"
  - tablist "Users and roles":
    - tab "Users 20" [selected]
    - tab "Roles 20"
    - tab "Delegations 1"
  - toolbar "Filters":
    - searchbox "Search name, email or employee ID"
    - combobox "Status":
      - option "All statuses" [selected]
      - option "Active"
      - option "Inactive"
      - option "Locked"
  - table:
    - rowgroup:
      - row "Name Roles (this factory) Status Last sign-in Actions":
        - columnheader "Name"
        - columnheader "Roles (this factory)"
        - columnheader "Status"
        - columnheader "Last sign-in"
        - columnheader "Actions"
    - rowgroup:
      - row "Demo Auditor auditor@demo.local Auditor Active Never Actions for Demo Auditor":
        - cell "Demo Auditor auditor@demo.local"
        - cell "Auditor"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Demo Auditor":
          - button "Actions for Demo Auditor"
      - row "Machine Operator operator@demo.local Machine Operator Active 11 Oct 2026, 6:58 pm Actions for Machine Operator":
        - cell "Machine Operator operator@demo.local"
        - cell "Machine Operator"
        - cell "Active"
        - cell "11 Oct 2026, 6:58 pm"
        - cell "Actions for Machine Operator":
          - button "Actions for Machine Operator"
      - row "Quality Inspector qc@demo.local Quality Inspector Active Never Actions for Quality Inspector":
        - cell "Quality Inspector qc@demo.local"
        - cell "Quality Inspector"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Quality Inspector":
          - button "Actions for Quality Inspector"
      - row "Inventory Manager inventory@demo.local Inventory Manager Active Never Actions for Inventory Manager":
        - cell "Inventory Manager inventory@demo.local"
        - cell "Inventory Manager"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Inventory Manager":
          - button "Actions for Inventory Manager"
      - row "Warehouse Manager warehouse@demo.local Warehouse Manager Active Never Actions for Warehouse Manager":
        - cell "Warehouse Manager warehouse@demo.local"
        - cell "Warehouse Manager"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Warehouse Manager":
          - button "Actions for Warehouse Manager"
      - row "Purchase Manager purchase@demo.local Purchase Manager Active Never Actions for Purchase Manager":
        - cell "Purchase Manager purchase@demo.local"
        - cell "Purchase Manager"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Purchase Manager":
          - button "Actions for Purchase Manager"
      - row "Store Keeper storekeeper@demo.local Store Keeper Active 11 Oct 2026, 7:05 pm Actions for Store Keeper":
        - cell "Store Keeper storekeeper@demo.local"
        - cell "Store Keeper"
        - cell "Active"
        - cell "11 Oct 2026, 7:05 pm"
        - cell "Actions for Store Keeper":
          - button "Actions for Store Keeper"
      - row "Production Manager production-manager@demo.local Production Manager Active Never Actions for Production Manager":
        - cell "Production Manager production-manager@demo.local"
        - cell "Production Manager"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Production Manager":
          - button "Actions for Production Manager"
      - row "Production Planner planner@demo.local Production Planner Active Never Actions for Production Planner":
        - cell "Production Planner planner@demo.local"
        - cell "Production Planner"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Production Planner":
          - button "Actions for Production Planner"
      - row "Sampling Team sampling@demo.local Sampling Team Active Never Actions for Sampling Team":
        - cell "Sampling Team sampling@demo.local"
        - cell "Sampling Team"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Sampling Team":
          - button "Actions for Sampling Team"
      - row "Pattern Master pattern@demo.local Pattern Master Active Never Actions for Pattern Master":
        - cell "Pattern Master pattern@demo.local"
        - cell "Pattern Master"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Pattern Master":
          - button "Actions for Pattern Master"
      - row "Design Manager design-manager@demo.local Design Manager Active Never Actions for Design Manager":
        - cell "Design Manager design-manager@demo.local"
        - cell "Design Manager"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Design Manager":
          - button "Actions for Design Manager"
      - row "Demo Designer designer@demo.local Designer Active 11 Oct 2026, 6:54 pm Actions for Demo Designer":
        - cell "Demo Designer designer@demo.local"
        - cell "Designer"
        - cell "Active"
        - cell "11 Oct 2026, 6:54 pm"
        - cell "Actions for Demo Designer":
          - button "Actions for Demo Designer"
      - row "Finance Sub Admin finance-admin@demo.local Finance Sub Admin Active Never Actions for Finance Sub Admin":
        - cell "Finance Sub Admin finance-admin@demo.local"
        - cell "Finance Sub Admin"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Finance Sub Admin":
          - button "Actions for Finance Sub Admin"
      - row "Quality Sub Admin quality-admin@demo.local Quality Sub Admin Active Never Actions for Quality Sub Admin":
        - cell "Quality Sub Admin quality-admin@demo.local"
        - cell "Quality Sub Admin"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Quality Sub Admin":
          - button "Actions for Quality Sub Admin"
      - row "Warehouse Sub Admin warehouse-admin@demo.local Warehouse Sub Admin Active Never Actions for Warehouse Sub Admin":
        - cell "Warehouse Sub Admin warehouse-admin@demo.local"
        - cell "Warehouse Sub Admin"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Warehouse Sub Admin":
          - button "Actions for Warehouse Sub Admin"
      - row "Purchase Sub Admin purchase-admin@demo.local Purchase Sub Admin Active Never Actions for Purchase Sub Admin":
        - cell "Purchase Sub Admin purchase-admin@demo.local"
        - cell "Purchase Sub Admin"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Purchase Sub Admin":
          - button "Actions for Purchase Sub Admin"
      - row "Inventory Sub Admin inventory-admin@demo.local Inventory Sub Admin Active Never Actions for Inventory Sub Admin":
        - cell "Inventory Sub Admin inventory-admin@demo.local"
        - cell "Inventory Sub Admin"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Inventory Sub Admin":
          - button "Actions for Inventory Sub Admin"
      - row "Production Sub Admin production-admin@demo.local Production Sub Admin Active Never Actions for Production Sub Admin":
        - cell "Production Sub Admin production-admin@demo.local"
        - cell "Production Sub Admin"
        - cell "Active"
        - cell "Never"
        - cell "Actions for Production Sub Admin":
          - button "Actions for Production Sub Admin"
      - row "Factory Admin admin@demo.local Factory Admin Active 11 Oct 2026, 7:06 pm Actions for Factory Admin":
        - cell "Factory Admin admin@demo.local"
        - cell "Factory Admin"
        - cell "Active"
        - cell "11 Oct 2026, 7:06 pm"
        - cell "Actions for Factory Admin":
          - button "Actions for Factory Admin"
  - navigation "Pagination":
    - paragraph: 1–20 of 20 users
    - button "Previous page" [disabled]: Previous
    - button "Next page" [disabled]: Next
- region "Notifications"
- button "Open messages"
- dialog "New user":
  - heading "New user" [level=2]
  - paragraph: They sign in with this email and the temporary password you set.
  - button "Close"
  - text: First name
  - textbox "First name": Qa
  - text: Last name
  - textbox "Last name": Tester
  - text: Work email
  - textbox "Work email": qa-mv3va9yv@demo.local
  - text: Temporary password
  - textbox "Temporary password": TempPass@123
  - paragraph: At least 8 characters. Share it with them securely.
  - text: Phone
  - textbox "Phone"
  - group "First role (optional)":
    - text: First role (optional)
    - paragraph: Roles decide what they can see and do at a factory. You can add more later.
    - text: Factory
    - combobox "Factory":
      - option "F01 — Main Production Unit" [selected]
    - text: Role
    - combobox "Role":
      - option "No role yet"
      - option "Auditor"
      - option "Designer"
      - option "Design Manager"
      - option "Factory Admin"
      - option "Inventory Manager"
      - option "Machine Operator"
      - option "Pattern Master"
      - option "Production Manager"
      - option "Production Planner"
      - option "Purchase Manager"
      - option "Quality Inspector" [selected]
      - option "Sampling Team"
      - option "Store Keeper"
      - option "Finance Sub Admin"
      - option "Inventory Sub Admin"
      - option "Production Sub Admin"
      - option "Purchase Sub Admin"
      - option "Quality Sub Admin"
      - option "Warehouse Sub Admin"
      - option "Warehouse Manager"
  - button "Cancel"
  - button "Create user" [disabled]
```

# Test source

```ts
  93  |   };
  94  | }
  95  | 
  96  | /** Browser context seeded with an existing API session (optionally a custom viewport). */
  97  | export async function openSession(
  98  |   browser: Browser,
  99  |   session: Session,
  100 |   opts: { viewport?: { width: number; height: number }; mobile?: boolean } = {},
  101 | ) {
  102 |   const context: BrowserContext = await browser.newContext({
  103 |     viewport: opts.viewport || { width: 1440, height: 900 },
  104 |     ...(opts.mobile ? { isMobile: true, hasTouch: true } : {}),
  105 |   });
  106 |   await context.addInitScript(([token, factoryId]) => {
  107 |     if (!sessionStorage.getItem('__e2e_seeded')) {
  108 |       localStorage.setItem('accessToken', token);
  109 |       if (factoryId) localStorage.setItem('factoryId', factoryId);
  110 |       sessionStorage.setItem('__e2e_seeded', '1');
  111 |     }
  112 |   }, [session.accessToken, session.factoryId || ''] as const);
  113 |   const page = await context.newPage();
  114 |   const problems = watchProblems(page);
  115 |   return { context, page, session, problems };
  116 | }
  117 | 
  118 | /**
  119 |  * Like `loginAs`, but the password login runs through the browser context's own request client,
  120 |  * so the httpOnly `refreshToken` cookie lands in the context's cookie jar — exactly as after a
  121 |  * real sign-in. Needed for anything that exercises the silent refresh (frontend/src/services/api.ts).
  122 |  * Accepts a seeded role key or explicit credentials.
  123 |  */
  124 | export async function loginWithRefreshCookie(
  125 |   browser: Browser,
  126 |   who: RoleKey | { email: string; password: string },
  127 |   opts: { viewport?: { width: number; height: number } } = {},
  128 | ) {
  129 |   const creds = typeof who === 'string' ? USERS[who] : who;
  130 |   const context: BrowserContext = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 } });
  131 |   const deviceId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  132 |   const res = await context.request.post(`${API_URL}/auth/login`, { data: creds, headers: { 'x-device-id': deviceId } });
  133 |   const body = await res.json();
  134 |   expect(body.success, `login ${creds.email}: ${body?.error?.message}`).toBeTruthy();
  135 |   const session: Session = {
  136 |     accessToken: body.data.accessToken,
  137 |     factoryId: body.data.factories?.[0]?._id,
  138 |     userId: body.data.user?._id,
  139 |   };
  140 |   const cookies = await context.cookies(API_URL);
  141 |   expect(cookies.some((c) => c.name === 'refreshToken'), 'refresh cookie stored in the browser context').toBeTruthy();
  142 |   await context.addInitScript(([token, factoryId, device]) => {
  143 |     if (!sessionStorage.getItem('__e2e_seeded')) {
  144 |       localStorage.setItem('accessToken', token);
  145 |       localStorage.setItem('erp-device-id', device);
  146 |       if (factoryId) localStorage.setItem('factoryId', factoryId);
  147 |       sessionStorage.setItem('__e2e_seeded', '1');
  148 |     }
  149 |   }, [session.accessToken, session.factoryId || '', deviceId] as const);
  150 |   const page = await context.newPage();
  151 |   const problems = watchProblems(page);
  152 |   return { context, page, session, problems };
  153 | }
  154 | 
  155 | /**
  156 |  * Collect uncaught page errors, console errors and error toasts. Call `problems.assertNone()`
  157 |  * at the end of a step; pass `allow` regexes for errors the step deliberately triggers.
  158 |  */
  159 | export function watchProblems(page: Page) {
  160 |   const items: string[] = [];
  161 |   page.on('pageerror', (e) => items.push(`pageerror: ${e.message}`));
  162 |   page.on('console', (m) => {
  163 |     if (m.type() !== 'error') return;
  164 |     const t = m.text();
  165 |     // Network failures are surfaced as toasts/assertions instead; ignore noise.
  166 |     if (/Failed to load resource|favicon|ERR_ABORTED|WebSocket/i.test(t)) return;
  167 |     items.push(`console: ${t}`);
  168 |   });
  169 |   // Any API error surfaced to the user as an error toast counts as a problem.
  170 |   void page.exposeBinding('__e2eErrorToast', (_src, text: string) => items.push(`error toast: ${text}`)).catch(() => {});
  171 |   void page.addInitScript(() => {
  172 |     const seen = new WeakSet<Element>();
  173 |     new MutationObserver(() => {
  174 |       document.querySelectorAll('.erp-toast[role="alert"]').forEach((el) => {
  175 |         if (seen.has(el)) return;
  176 |         seen.add(el);
  177 |         (window as unknown as { __e2eErrorToast?: (t: string) => void }).__e2eErrorToast?.((el as HTMLElement).innerText);
  178 |       });
  179 |     }).observe(document, { childList: true, subtree: true });
  180 |   }).catch(() => {});
  181 |   return {
  182 |     items,
  183 |     clear: () => items.splice(0, items.length),
  184 |     assertNone: (allow: RegExp[] = []) => {
  185 |       const bad = items.filter((i) => !allow.some((r) => r.test(i)));
  186 |       expect(bad, bad.join('\n')).toEqual([]);
  187 |     },
  188 |   };
  189 | }
  190 | 
  191 | /** Wait for a toast containing `text` (success or info). */
  192 | export async function expectToast(page: Page, text: string | RegExp) {
> 193 |   await expect(page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first()).toBeVisible({ timeout: 10_000 });
      |                                                                                                   ^ Error: expect(locator).toBeVisible() failed
  194 | }
  195 | 
  196 | /** Error toasts render as `.erp-toast[role="alert"]`. */
  197 | export const errorToast = (page: Page) => page.locator('.erp-toast[role="alert"]');
  198 | 
  199 | /** Fail fast if an error toast is showing. */
  200 | export async function expectNoErrorToast(page: Page) {
  201 |   const err = errorToast(page);
  202 |   if (await err.count()) {
  203 |     throw new Error(`Error toast shown: ${await err.first().innerText()}`);
  204 |   }
  205 | }
  206 | 
  207 | export function uniq(prefix: string) {
  208 |   return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  209 | }
  210 | 
```