# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-flow.spec.ts >> Roles: create custom role via matrix (incl. chat.group.*), duplicate, edit, delete
- Location: e2e\admin-flow.spec.ts:320:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e4]:
    - link "Skip to content" [ref=e5] [cursor=pointer]:
      - /url: "#erp-main"
    - complementary "Sidebar" [ref=e6]:
      - link "ERP Factory — dashboard" [ref=e8] [cursor=pointer]:
        - /url: /
        - generic [ref=e9]: EF
        - generic [ref=e10]:
          - generic [ref=e11]: ERP Factory
          - generic [ref=e12]: Factory workspace
      - navigation "Main" [ref=e13]:
        - list [ref=e15]:
          - listitem [ref=e16]:
            - link "Dashboard" [ref=e17] [cursor=pointer]:
              - /url: /
              - img [ref=e18]
              - generic [ref=e23]: Dashboard
          - listitem [ref=e24]:
            - link "Approvals" [ref=e25] [cursor=pointer]:
              - /url: /approvals
              - img [ref=e26]
              - generic [ref=e29]: Approvals
        - generic [ref=e30]:
          - paragraph [ref=e31]: Develop
          - list [ref=e32]:
            - listitem [ref=e33]:
              - link "Designs" [ref=e34] [cursor=pointer]:
                - /url: /designs
                - img [ref=e35]
                - generic [ref=e41]: Designs
            - listitem [ref=e42]:
              - link "Patterns" [ref=e43] [cursor=pointer]:
                - /url: /pattern
                - img [ref=e44]
                - generic [ref=e50]: Patterns
            - listitem [ref=e51]:
              - link "Samples" [ref=e52] [cursor=pointer]:
                - /url: /samples
                - img [ref=e53]
                - generic [ref=e55]: Samples
        - generic [ref=e56]:
          - paragraph [ref=e57]: Products
          - list [ref=e58]:
            - listitem [ref=e59]:
              - link "SKUs" [ref=e60] [cursor=pointer]:
                - /url: /products/skus
                - img [ref=e61]
                - generic [ref=e64]: SKUs
            - listitem [ref=e65]:
              - link "BOMs" [ref=e66] [cursor=pointer]:
                - /url: /products/boms
                - img [ref=e67]
                - generic [ref=e71]: BOMs
        - generic [ref=e72]:
          - paragraph [ref=e73]: Procure
          - list [ref=e74]:
            - listitem [ref=e75]:
              - link "Purchase" [ref=e76] [cursor=pointer]:
                - /url: /purchase
                - img [ref=e77]
                - generic [ref=e81]: Purchase
            - listitem [ref=e82]:
              - link "Vendors" [ref=e83] [cursor=pointer]:
                - /url: /vendors
                - img [ref=e84]
                - generic [ref=e88]: Vendors
        - generic [ref=e89]:
          - paragraph [ref=e90]: Stock
          - list [ref=e91]:
            - listitem [ref=e92]:
              - link "Inventory" [ref=e93] [cursor=pointer]:
                - /url: /inventory
                - img [ref=e94]
                - generic [ref=e104]: Inventory
            - listitem [ref=e105]:
              - button "Warehouse" [ref=e107] [cursor=pointer]:
                - img [ref=e108]
                - generic [ref=e111]: Warehouse
                - img [ref=e112]
        - generic [ref=e114]:
          - paragraph [ref=e115]: Make
          - list [ref=e116]:
            - listitem [ref=e117]:
              - link "Production orders" [ref=e118] [cursor=pointer]:
                - /url: /production/orders
                - img [ref=e119]
                - generic [ref=e121]: Production orders
            - listitem [ref=e122]:
              - link "Machines & capacity" [ref=e123] [cursor=pointer]:
                - /url: /production/machines
                - img [ref=e124]
                - generic [ref=e135]: Machines & capacity
            - listitem [ref=e136]:
              - link "Waste" [ref=e137] [cursor=pointer]:
                - /url: /waste
                - img [ref=e138]
                - generic [ref=e145]: Waste
        - generic [ref=e146]:
          - paragraph [ref=e147]: Quality
          - list [ref=e148]:
            - listitem [ref=e149]:
              - link "Inspections" [ref=e150] [cursor=pointer]:
                - /url: /quality/inspections
                - img [ref=e151]
                - generic [ref=e155]: Inspections
            - listitem [ref=e156]:
              - link "CAPA" [ref=e157] [cursor=pointer]:
                - /url: /quality/capa
                - img [ref=e158]
                - generic [ref=e161]: CAPA
            - listitem [ref=e162]:
              - link "Templates" [ref=e163] [cursor=pointer]:
                - /url: /quality/templates
                - img [ref=e164]
                - generic [ref=e167]: Templates
        - generic [ref=e168]:
          - paragraph [ref=e169]: Insights
          - list [ref=e170]:
            - listitem [ref=e171]:
              - link "Reports" [ref=e172] [cursor=pointer]:
                - /url: /reports/factory
                - img [ref=e173]
                - generic [ref=e175]: Reports
            - listitem [ref=e176]:
              - link "Notifications" [ref=e177] [cursor=pointer]:
                - /url: /notifications
                - img [ref=e178]
                - generic [ref=e181]: Notifications
            - listitem [ref=e182]:
              - link "Messages" [ref=e183] [cursor=pointer]:
                - /url: /chat
                - img [ref=e184]
                - generic [ref=e186]: Messages
        - generic [ref=e187]:
          - paragraph [ref=e188]: Administration
          - list [ref=e189]:
            - listitem [ref=e190]:
              - link "Users & roles" [ref=e191] [cursor=pointer]:
                - /url: /users
                - img [ref=e192]
                - generic [ref=e197]: Users & roles
            - listitem [ref=e198]:
              - link "Approval workflows" [ref=e199] [cursor=pointer]:
                - /url: /approvals?tab=workflows
                - img [ref=e200]
                - generic [ref=e204]: Approval workflows
            - listitem [ref=e205]:
              - link "Settings" [ref=e206] [cursor=pointer]:
                - /url: /settings
                - img [ref=e207]
                - generic [ref=e210]: Settings
            - listitem [ref=e211]:
              - link "Factory settings" [ref=e212] [cursor=pointer]:
                - /url: /settings/factory-settings
                - img [ref=e213]
                - generic [ref=e216]: Factory settings
            - listitem [ref=e217]:
              - link "Inventory codes" [ref=e218] [cursor=pointer]:
                - /url: /settings/inventory-codes
                - img [ref=e219]
                - generic [ref=e220]: Inventory codes
            - listitem [ref=e221]:
              - link "Audit logs" [ref=e222] [cursor=pointer]:
                - /url: /audit
                - img [ref=e223]
                - generic [ref=e227]: Audit logs
      - button "Collapse sidebar" [ref=e230] [cursor=pointer]:
        - img [ref=e231]
        - generic [ref=e234]: Collapse
    - generic [ref=e235]:
      - banner [ref=e236]:
        - navigation "Breadcrumb" [ref=e238]:
          - list [ref=e239]:
            - listitem [ref=e240]: Administration
            - listitem [ref=e241]:
              - img [ref=e242]
            - listitem [ref=e244]: Users & roles
        - button "Search pages and actions" [ref=e245] [cursor=pointer]:
          - img [ref=e246]
          - generic [ref=e249]: Search…
          - generic [ref=e250]: Ctrl K
        - generic "F01 — Main Production Unit" [ref=e251]: Main Production Unit
        - generic [ref=e252]:
          - button "Messages" [ref=e253] [cursor=pointer]:
            - img [ref=e254]
          - button "Notifications, 18 unread" [ref=e257] [cursor=pointer]:
            - img [ref=e258]
            - generic [ref=e261]: 9+
        - button "Account menu for Factory Admin" [ref=e263] [cursor=pointer]:
          - generic [ref=e264]: FA
          - img [ref=e265]
      - main [active] [ref=e267]:
        - generic [ref=e268]:
          - generic [ref=e270]:
            - generic [ref=e271]:
              - heading "Users & roles" [level=1] [ref=e273]
              - paragraph [ref=e274]: Invite people, give them roles per factory, and control what each role can do.
            - button "New role" [ref=e276] [cursor=pointer]:
              - img [ref=e277]
              - text: New role
          - generic [ref=e278]:
            - img [ref=e279]
            - generic [ref=e281]:
              - paragraph [ref=e282]: How access works
              - text: A role is a set of permissions (for example Designer). People get one or more roles at each factory. System roles are fixed; create custom roles when you need a different mix. Delegations lend permissions temporarily.
            - button "Dismiss" [ref=e283] [cursor=pointer]:
              - img [ref=e284]
          - tablist "Users and roles" [ref=e287]:
            - tab "Users 21" [ref=e288] [cursor=pointer]:
              - text: Users
              - generic [ref=e289]: "21"
            - tab "Roles 21" [selected] [ref=e290] [cursor=pointer]:
              - text: Roles
              - generic [ref=e291]: "21"
            - tab "Delegations 1" [ref=e292] [cursor=pointer]:
              - text: Delegations
              - generic [ref=e293]: "1"
          - generic [ref=e295]:
            - toolbar "Filters" [ref=e296]:
              - generic [ref=e298]:
                - img
                - searchbox "Search roles" [ref=e299]: QA Lead-MV3VC9L7
                - button "Clear search" [ref=e300] [cursor=pointer]:
                  - img [ref=e301]
              - combobox "Role type" [ref=e305] [cursor=pointer]:
                - option "All roles" [selected]
                - option "System roles"
                - option "Custom roles"
              - button "Clear filters" [ref=e306] [cursor=pointer]:
                - img [ref=e307]
                - text: Clear filters
            - table [ref=e310]:
              - rowgroup [ref=e311]:
                - row "Role Code Permissions Type" [ref=e312]:
                  - columnheader "Role" [ref=e313]
                  - columnheader "Code" [ref=e314]
                  - columnheader "Permissions" [ref=e315]
                  - columnheader "Type" [ref=e316]
              - rowgroup [ref=e317]:
                - row "QA Lead-MV3VC9L7 QA_LEAD_MV3VC9L7 12 Custom" [ref=e318] [cursor=pointer]:
                  - cell "QA Lead-MV3VC9L7" [ref=e319]
                  - cell "QA_LEAD_MV3VC9L7" [ref=e320]
                  - cell "12" [ref=e321]
                  - cell "Custom" [ref=e322]:
                    - generic [ref=e324]: Custom
  - region "Notifications"
  - generic [ref=e326]:
    - generic "Drag up or down to reposition" [ref=e327]:
      - img [ref=e328]
    - button "Open messages" [ref=e335]:
      - img [ref=e336]
      - generic: Messages (drag to move)
  - generic:
    - dialog:
      - banner:
        - generic:
          - img
          - generic:
            - heading [level=2]: Messages
        - generic:
          - link:
            - /url: /chat
            - text: All chats
          - button:
            - img
      - generic:
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - img
                  - searchbox
                - generic:
                  - combobox
                  - button [disabled]: Chat
                  - generic:
                    - button:
                      - img
              - generic:
                - button:
                  - generic: PT
                  - generic:
                    - generic:
                      - paragraph: Production Team
                      - generic: 06:47 PM
                    - paragraph: Fabric receipt expected tomorrow.
                - button:
                  - generic: MO
                  - generic:
                    - generic:
                      - paragraph: Machine Operator
                    - paragraph: No messages
```

# Test source

```ts
  253 |   await expectToast(page, /saved|updated/i);
  254 |   ud = dialog(page, 'Qa Tester-Edited');
  255 |   await expect(ud).toBeVisible();
  256 | 
  257 |   // Assign another role at the factory
  258 |   await ud.getByRole('button', { name: 'Assign role' }).click();
  259 |   const ar = dialog(page, /Assign a role to/);
  260 |   await ar.getByLabel('Role').selectOption({ label: 'Auditor' });
  261 |   await ar.getByRole('button', { name: 'Assign role' }).click();
  262 |   await expectToast(page, /assigned/i);
  263 |   await expect(ud).toContainText('Auditor');
  264 | 
  265 |   // Remove a role (confirm)
  266 |   await ud.getByRole('button', { name: 'Remove Auditor' }).click();
  267 |   const rm = dialog(page, 'Remove Auditor?');
  268 |   await rm.getByRole('button', { name: /Remove/ }).last().click();
  269 |   await expectToast(page, /removed/i);
  270 |   await expect(ud.getByRole('button', { name: 'Remove Auditor' })).toHaveCount(0);
  271 | 
  272 |   // Reset password (prompt)
  273 |   const newTemp = 'Reset@12345';
  274 |   await ud.getByRole('button', { name: 'More' }).click();
  275 |   await page.getByRole('menuitem', { name: 'Reset password…' }).click();
  276 |   const rp = dialog(page, /Reset password for/);
  277 |   await rp.getByLabel('Temporary password').fill('short');
  278 |   await rp.getByRole('button', { name: 'Reset password' }).click();
  279 |   await expect(rp.getByRole('alert')).toBeVisible();
  280 |   await rp.getByLabel('Temporary password').fill(newTemp);
  281 |   await rp.getByRole('button', { name: 'Reset password' }).click();
  282 |   await expectToast(page, 'Password reset');
  283 |   expect((await apiLoginWith(request, email, password)).ok, 'old password refused').toBeFalsy();
  284 |   expect((await apiLoginWith(request, email, newTemp)).ok, 'new temp password works').toBeTruthy();
  285 | 
  286 |   // Lock → login fails; unlock → login works
  287 |   await ud.getByRole('button', { name: 'More' }).click();
  288 |   await page.getByRole('menuitem', { name: 'Lock account' }).click();
  289 |   await dialog(page, /^Lock /).getByRole('button', { name: 'Lock account' }).click();
  290 |   await expectToast(page, 'Account locked');
  291 |   const locked = await apiLoginWith(request, email, newTemp);
  292 |   expect(locked.ok, 'locked user cannot sign in').toBeFalsy();
  293 |   await ud.getByRole('button', { name: 'More' }).click();
  294 |   await page.getByRole('menuitem', { name: 'Unlock account' }).click();
  295 |   await dialog(page, /^Unlock /).getByRole('button', { name: 'Unlock' }).click();
  296 |   await expectToast(page, 'Account unlocked');
  297 |   expect((await apiLoginWith(request, email, newTemp)).ok, 'unlocked user can sign in').toBeTruthy();
  298 | 
  299 |   // Deactivate → login fails; activate → works
  300 |   await ud.getByRole('button', { name: 'More' }).click();
  301 |   await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  302 |   await dialog(page, /^Deactivate /).getByRole('button', { name: 'Deactivate' }).click();
  303 |   await expectToast(page, 'User deactivated');
  304 |   expect((await apiLoginWith(request, email, newTemp)).ok, 'inactive user cannot sign in').toBeFalsy();
  305 |   await ud.getByRole('button', { name: 'More' }).click();
  306 |   await page.getByRole('menuitem', { name: 'Activate' }).click();
  307 |   await expectToast(page, 'User activated');
  308 |   expect((await apiLoginWith(request, email, newTemp)).ok, 'reactivated user can sign in').toBeTruthy();
  309 | 
  310 |   // Status filter shows them as active
  311 |   await ud.getByRole('button', { name: 'Close' }).last().click();
  312 |   await page.getByLabel('Status').selectOption('ACTIVE');
  313 |   await page.getByPlaceholder(/Search/).first().fill(tag);
  314 |   await expect(page.locator('tbody tr').filter({ hasText: email })).toHaveCount(1);
  315 |   void session;
  316 |   problems.assertNone();
  317 |   await context.close();
  318 | });
  319 | 
  320 | test('Roles: create custom role via matrix (incl. chat.group.*), duplicate, edit, delete', async ({ browser, request }) => {
  321 |   test.setTimeout(180_000);
  322 |   const { context, page, session, problems } = await loginAs(browser, request, 'admin');
  323 |   const a = api(request, session);
  324 |   const name = uniq('QA Lead');
  325 |   const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  326 | 
  327 |   await page.goto('/users?tab=roles');
  328 |   await expect(page.getByRole('tab', { name: /Roles/ })).toHaveAttribute('aria-selected', 'true');
  329 |   await page.getByRole('button', { name: 'New role' }).first().click();
  330 |   const d = dialog(page, 'New role');
  331 |   await d.getByLabel('Display name').fill(name);
  332 |   await d.getByLabel('Code').fill(code);
  333 |   await d.getByRole('checkbox', { name: 'Select all Quality permissions' }).check();
  334 |   await d.getByRole('checkbox', { name: 'Select all Chat permissions' }).check();
  335 |   await d.getByRole('button', { name: 'Create role' }).click();
  336 |   await expectToast(page, /created/i);
  337 | 
  338 |   const roles = (await a.get('/roles')) as Array<{ _id: string; name: string; code: string; permissions: string[] }>;
  339 |   const created = roles.find((r) => r.code === code);
  340 |   expect(created, 'role saved').toBeTruthy();
  341 |   expect(created!.permissions).toEqual(expect.arrayContaining(['quality.read', 'chat.group.create', 'chat.group.manage']));
  342 | 
  343 |   // Open → edit (toggle one permission) → save
  344 |   await page.getByPlaceholder(/Search/).first().fill(name);
  345 |   await page.locator('tbody tr').filter({ hasText: name }).first().click();
  346 |   let rd = dialog(page, name);
  347 |   await expect(rd).toBeVisible();
  348 |   const inspectionToggle = rd.getByRole('checkbox', { name: 'Select all Reports permissions' });
  349 |   await inspectionToggle.check();
  350 |   await rd.getByRole('button', { name: /Save/ }).click();
  351 |   await expectToast(page, /saved|updated/i);
  352 |   const afterEdit = ((await a.get('/roles')) as typeof roles).find((r) => r.code === code)!;
> 353 |   expect(afterEdit.permissions.some((p) => p.startsWith('report.'))).toBeTruthy();
      |                                                                      ^ Error: expect(received).toBeTruthy()
  354 |   if (!(await rd.isVisible().catch(() => false))) {
  355 |     await page.locator('tbody tr').filter({ hasText: name }).first().click();
  356 |     rd = dialog(page, name);
  357 |   }
  358 | 
  359 |   // Duplicate
  360 |   await rd.getByRole('button', { name: 'More' }).click();
  361 |   await page.getByRole('menuitem', { name: 'Duplicate as new role' }).click();
  362 |   const dup = dialog(page, `Duplicate ${name}`);
  363 |   await expect(dup).toBeVisible();
  364 |   const dupName = `${name} copy`;
  365 |   await dup.getByLabel('Display name').fill(dupName);
  366 |   await dup.getByLabel('Code').fill(`${code}_COPY`);
  367 |   await dup.getByRole('button', { name: 'Create role' }).click();
  368 |   await expectToast(page, /created/i);
  369 |   const dupRole = ((await a.get('/roles')) as typeof roles).find((r) => r.code === `${code}_COPY`);
  370 |   expect(dupRole?.permissions.sort()).toEqual(afterEdit.permissions.sort());
  371 | 
  372 |   // Delete both
  373 |   for (const n of [dupName, name]) {
  374 |     await page.getByPlaceholder(/Search/).first().fill(n);
  375 |     await page.locator('tbody tr').filter({ hasText: n }).first().click();
  376 |     rd = dialog(page, n);
  377 |     await rd.getByRole('button', { name: 'More' }).click();
  378 |     await page.getByRole('menuitem', { name: 'Delete role' }).click();
  379 |     await dialog(page, `Delete ${n}?`).getByRole('button', { name: /Delete/ }).last().click();
  380 |     await expectToast(page, /deleted/i);
  381 |   }
  382 |   const left = (await a.get('/roles')) as typeof roles;
  383 |   expect(left.find((r) => r.code === code || r.code === `${code}_COPY`)).toBeFalsy();
  384 |   problems.assertNone();
  385 |   await context.close();
  386 | });
  387 | 
  388 | test('Delegations: create (now → +7d) and revoke', async ({ browser, request }) => {
  389 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  390 |   await page.goto('/users?tab=delegations');
  391 |   await settle(page);
  392 |   await page.getByRole('button', { name: 'New delegation' }).first().click();
  393 |   const d = dialog(page, 'New delegation');
  394 |   await d.getByRole('button', { name: 'Create delegation' }).click();
  395 |   await expect(d.getByText('Choose who receives the permissions.')).toBeVisible();
  396 |   const opts = await d.getByLabel('Delegate to').locator('option').allTextContents();
  397 |   const target = opts.find((o) => /Quality Inspector/.test(o)) || opts[1];
  398 |   await d.getByLabel('Delegate to').selectOption({ label: target });
  399 |   // default window is now → +7 days
  400 |   const start = await d.getByLabel('Starts').inputValue();
  401 |   const end = await d.getByLabel('Ends').inputValue();
  402 |   expect(Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)).toBe(7);
  403 |   await d.getByRole('checkbox', { name: 'Select all Approvals permissions' }).check();
  404 |   await d.getByRole('button', { name: 'Create delegation' }).click();
  405 |   await expectToast(page, 'Delegation created');
  406 |   const row = page.locator('tbody tr').filter({ hasText: target }).first();
  407 |   await expect(row).toBeVisible();
  408 |   await row.getByRole('button', { name: 'More actions' }).click();
  409 |   await page.getByRole('menuitem', { name: 'Revoke' }).click();
  410 |   await dialog(page, /Revoke/).getByRole('button', { name: /Revoke/ }).last().click();
  411 |   await expectToast(page, /revoked/i);
  412 |   problems.assertNone();
  413 |   await context.close();
  414 | });
  415 | 
  416 | // ─────────────────────────────── Settings ───────────────────────────────
  417 | 
  418 | test('Settings: general + factory settings, sticky save bar, discard, stages, integrations', async ({ browser, request }) => {
  419 |   test.setTimeout(180_000);
  420 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  421 |   await page.goto('/settings');
  422 |   await expect(page).toHaveURL(/\/settings\/general$/);
  423 |   await settle(page);
  424 | 
  425 |   // General: edit → save bar → discard → edit → save
  426 |   const days = page.getByLabel(/Warn when stock covers fewer than/);
  427 |   const original = await days.inputValue();
  428 |   await days.fill(String(Number(original || 7) === 9 ? 10 : 9));
  429 |   const bar = page.getByRole('region', { name: 'Unsaved changes' });
  430 |   await expect(bar).toBeVisible();
  431 |   await bar.getByRole('button', { name: 'Discard' }).click();
  432 |   await expect(bar).toBeHidden();
  433 |   await expect(days).toHaveValue(original);
  434 |   const target = original === '12' ? '13' : '12';
  435 |   await days.fill(target);
  436 |   await bar.getByRole('button', { name: /Save/ }).click();
  437 |   await expectToast(page, /saved/i);
  438 |   await expect(bar).toBeHidden();
  439 |   await page.reload();
  440 |   await expect(page.getByLabel(/Warn when stock covers fewer than/)).toHaveValue(target);
  441 | 
  442 |   // Factory settings: reorder stages, reject QC, save
  443 |   await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: /^Factory/ }).click();
  444 |   await expect(page).toHaveURL(/\/settings\/factory-settings$/);
  445 |   await settle(page);
  446 |   const stagesList = page.locator('section').filter({ hasText: 'Production stages' }).locator('ol li');
  447 |   const firstBefore = (await stagesList.nth(0).innerText()).replace(/^\d+\s*/, '').trim().split('\n')[0];
  448 |   const secondBefore = (await stagesList.nth(1).innerText()).replace(/^\d+\s*/, '').trim().split('\n')[0];
  449 |   await page.getByRole('button', { name: `Move ${secondBefore} up` }).click();
  450 |   await expect(stagesList.nth(0)).toContainText(secondBefore);
  451 |   await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible();
  452 | 
  453 |   const newStage = page.getByLabel('New stage name');
```