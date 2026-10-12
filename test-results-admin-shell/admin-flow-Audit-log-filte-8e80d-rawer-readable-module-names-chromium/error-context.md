# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-flow.spec.ts >> Audit log: filters, detail drawer, readable module names
- Location: e2e\admin-flow.spec.ts:566:1

# Error details

```
Error: expect(locator).not.toContainText(expected) failed

Locator: locator('[role="dialog"]:visible').last()
Expected pattern: not /\bv1\b/
Received string: "Changed password for user me10/10/2026, 12:43:58 AM · Just nowPOSTUserpw-mv1cfqz4@demo.localModuleUserRecord type—Record ID—EndpointPOST /api/v1/users/me/change-passwordIP address::1DeviceMozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36Close"
Timeout: 10000ms

Call log:
  - Expect "not toContainText" with timeout 10000ms
  - waiting for locator('[role="dialog"]:visible').last()
    23 × locator resolved to <div role="dialog" tabindex="-1" aria-modal="true" aria-labelledby=":r9:" aria-describedby=":ra:" class="erp-drawer sm:max-w-[560px] focus:outline-none">…</div>
       - unexpected value "Changed password for user me10/10/2026, 12:43:58 AM · Just nowPOSTUserpw-mv1cfqz4@demo.localModuleUserRecord type—Record ID—EndpointPOST /api/v1/users/me/change-passwordIP address::1DeviceMozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36Close"

```

```yaml
- dialog "Changed password for user me":
  - heading "Changed password for user me" [level=2]
  - paragraph: 10/10/2026, 12:43:58 AM · Just now
  - text: POST
  - button "Close"
  - term: User
  - definition: pw-mv1cfqz4@demo.local
  - term: Module
  - definition: User
  - term: Record type
  - definition: —
  - term: Record ID
  - definition: —
  - term: Endpoint
  - definition: POST /api/v1/users/me/change-password
  - term: IP address
  - definition: ::1
  - term: Device
  - definition: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36
  - button "Close"
```

# Test source

```ts
  495 |   await d.getByRole('button', { name: 'Create code' }).click();
  496 |   await expectToast(page, /created|saved/i);
  497 |   await page.getByPlaceholder(/Search code/).fill(code);
  498 |   const row = page.locator('tbody tr').filter({ hasText: code });
  499 |   await expect(row).toHaveCount(1);
  500 | 
  501 |   await row.getByRole('button', { name: 'More actions' }).click();
  502 |   await page.getByRole('menuitem', { name: /Edit/ }).click();
  503 |   const e = dialog(page, `Edit ${code}`);
  504 |   await e.getByLabel(/^Name/).fill('QA test code edited');
  505 |   await e.getByRole('button', { name: 'Save changes' }).click();
  506 |   await expectToast(page, /saved|updated/i);
  507 |   await expect(row).toContainText('QA test code edited');
  508 | 
  509 |   await row.getByRole('button', { name: 'More actions' }).click();
  510 |   await page.getByRole('menuitem', { name: /Delete/ }).click();
  511 |   await dialog(page, /Delete/).getByRole('button', { name: 'Delete code' }).click();
  512 |   await expectToast(page, /deleted/i);
  513 |   await expect(row).toHaveCount(0);
  514 |   problems.assertNone();
  515 |   await context.close();
  516 | });
  517 | 
  518 | test('My account: wrong current password shows inline error and keeps session; correct one works', async ({ browser, request }) => {
  519 |   // Throwaway user created via API so demo accounts keep their passwords.
  520 |   const admin = api(request, await apiLogin(request, 'admin'));
  521 |   const me = await admin.get('/users/me');
  522 |   const email = `${uniq('pw').toLowerCase()}@demo.local`;
  523 |   const pw1 = 'FirstPass@123';
  524 |   const pw2 = 'SecondPass@456';
  525 |   const user = await admin.post('/users', {
  526 |     email, password: pw1, firstName: 'Pw', lastName: 'Changer', organizationId: me.user.organizationId,
  527 |   });
  528 |   const roles = (await admin.get('/roles')) as Array<{ _id: string; code: string }>;
  529 |   await admin.post(`/users/${user._id}/roles`, {
  530 |     roleId: roles.find((r) => r.code === 'AUDITOR')!._id, factoryId: me.factories[0]._id, organizationId: me.user.organizationId,
  531 |   });
  532 | 
  533 |   const { context, page, problems } = await openSession(browser, await apiLoginAs(request, email, pw1));
  534 |   await page.goto('/');
  535 |   await page.getByRole('button', { name: /Account menu for/ }).click();
  536 |   await page.getByRole('menuitem', { name: 'My account' }).click();
  537 |   await expect(page).toHaveURL(/\/settings\/account$/);
  538 | 
  539 |   await page.getByLabel('Current password').fill('WrongPass@000');
  540 |   await page.getByLabel(/^New password/).fill(pw2);
  541 |   await page.getByLabel('Confirm new password').fill(pw2);
  542 |   await page.getByRole('button', { name: 'Update password' }).click();
  543 |   await expect(page.getByText('Current password is incorrect')).toBeVisible();
  544 |   await expect(page).toHaveURL(/\/settings\/account$/);
  545 |   // Still signed in: navigation works
  546 |   await page.goto('/');
  547 |   await expect(page.locator('#erp-main')).toBeVisible();
  548 |   await expect(page).not.toHaveURL(/login/);
  549 |   problems.assertNone([/error toast: Current password is incorrect/, /console:.*400/]);
  550 |   problems.clear();
  551 | 
  552 |   await page.goto('/settings/account');
  553 |   await page.getByLabel('Current password').fill(pw1);
  554 |   await page.getByLabel(/^New password/).fill(pw2);
  555 |   await page.getByLabel('Confirm new password').fill(pw2);
  556 |   await page.getByRole('button', { name: 'Update password' }).click();
  557 |   await expectToast(page, 'Password changed');
  558 |   expect((await apiLoginWith(request, email, pw1)).ok, 'old password refused').toBeFalsy();
  559 |   expect((await apiLoginWith(request, email, pw2)).ok, 'new password works').toBeTruthy();
  560 |   problems.assertNone();
  561 |   await context.close();
  562 | });
  563 | 
  564 | // ─────────────────────────────── Audit / reports / notifications ───────────────────────────────
  565 | 
  566 | test('Audit log: filters, detail drawer, readable module names', async ({ browser, request }) => {
  567 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  568 |   await page.goto('/audit');
  569 |   await settle(page);
  570 |   const moduleSel = page.getByLabel('Module');
  571 |   const moduleLabels = await moduleSel.locator('option').allTextContents();
  572 |   expect(moduleLabels.length).toBeGreaterThan(1);
  573 |   for (const l of moduleLabels) expect(l, 'module label readable').not.toMatch(/^v\d+$|^api$/i);
  574 |   const cells = await page.locator('tbody tr td:nth-child(4)').allTextContents();
  575 |   for (const c of cells) expect(c.trim(), 'module cell readable').not.toMatch(/^v\d+$/i);
  576 | 
  577 |   // Filters
  578 |   const firstModule = await moduleSel.locator('option').nth(1).getAttribute('value');
  579 |   await moduleSel.selectOption(firstModule!);
  580 |   await settle(page);
  581 |   await page.getByLabel('Date range').selectOption({ index: 1 });
  582 |   await settle(page);
  583 |   await page.getByLabel('Action', { exact: true }).selectOption({ index: 1 });
  584 |   await settle(page);
  585 |   await page.getByPlaceholder('Filter by user email…').fill('admin@');
  586 |   await settle(page);
  587 |   await page.getByRole('button', { name: 'Clear filters' }).first().click();
  588 |   await expect(page.getByLabel('Module')).toHaveValue('');
  589 |   await settle(page);
  590 | 
  591 |   // Detail drawer
  592 |   await page.locator('tbody tr').first().click();
  593 |   const drawer = page.locator('[role="dialog"]:visible').last();
  594 |   await expect(drawer).toBeVisible();
> 595 |   await expect(drawer).not.toContainText(/\bv1\b/);
      |                            ^ Error: expect(locator).not.toContainText(expected) failed
  596 |   await drawer.getByRole('button', { name: 'Close' }).last().click();
  597 |   problems.assertNone();
  598 |   await context.close();
  599 | });
  600 | 
  601 | test('Reports: every tab loads, period filter, export', async ({ browser, request }) => {
  602 |   test.setTimeout(180_000);
  603 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  604 |   await page.goto('/reports');
  605 |   await expect(page).toHaveURL(/\/reports\/factory$/);
  606 |   await settle(page);
  607 |   const tabs = page.getByRole('tablist').first().getByRole('tab');
  608 |   const n = await tabs.count();
  609 |   expect(n).toBeGreaterThan(1);
  610 |   for (let i = 0; i < n; i++) {
  611 |     problems.clear();
  612 |     await tabs.nth(i).click();
  613 |     await settle(page);
  614 |     await expect(page.locator('[aria-label="Loading report"]')).toHaveCount(0, { timeout: 15_000 });
  615 |     await expect(page.locator('#erp-main')).not.toContainText('NaN');
  616 |     problems.assertNone();
  617 |   }
  618 |   await page.getByLabel('Period').selectOption({ index: 1 });
  619 |   await settle(page);
  620 |   const download = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
  621 |   await page.getByRole('button', { name: 'Export CSV' }).click();
  622 |   const dl = await download;
  623 |   if (!dl) await expectToast(page, /exported/i);
  624 |   problems.assertNone();
  625 |   await context.close();
  626 | });
  627 | 
  628 | test('Notifications page: tabs and filters', async ({ browser, request }) => {
  629 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  630 |   await page.goto('/notifications');
  631 |   await settle(page);
  632 |   for (const t of ['Unread', 'Read', 'All']) {
  633 |     await page.getByRole('tab', { name: new RegExp(`^${t}`) }).click();
  634 |     await settle(page);
  635 |   }
  636 |   const ev = page.getByLabel('Event type');
  637 |   if (await ev.locator('option').count() > 1) await ev.selectOption({ index: 1 });
  638 |   await settle(page);
  639 |   await page.getByLabel('Period').selectOption({ index: 1 });
  640 |   await settle(page);
  641 |   problems.assertNone();
  642 |   await context.close();
  643 | });
  644 | 
  645 | // ─────────────────────────────── Super admin ───────────────────────────────
  646 | 
  647 | test('Super admin: organizations page', async ({ browser, request }) => {
  648 |   const { context, page, problems } = await loginAs(browser, request, 'superAdmin');
  649 |   await page.goto('/');
  650 |   await page.locator('aside[aria-label="Sidebar"]').getByRole('link', { name: 'Organizations' }).click();
  651 |   await expect(page).toHaveURL(/\/admin\/organizations$/);
  652 |   await settle(page);
  653 |   await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
  654 |   await expect(page.locator('tbody tr').first()).toBeVisible();
  655 |   await page.getByPlaceholder('Search organizations…').fill('zzzz-none');
  656 |   await expect(page.getByText('No organizations match')).toBeVisible();
  657 |   problems.assertNone();
  658 |   await context.close();
  659 | 
  660 |   // A factory admin is bounced from the organizations page
  661 |   const fa = await loginAs(browser, request, 'admin');
  662 |   await fa.page.goto('/admin/organizations');
  663 |   await expect(fa.page).toHaveURL(/\/$/);
  664 |   await fa.context.close();
  665 | });
  666 | 
```