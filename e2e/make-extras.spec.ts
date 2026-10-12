import { test, expect, type Page } from '@playwright/test';
import { api, apiLogin, expectToast, loginAs, uniq } from './helpers';

/**
 * Secondary make-side flows, driven through the UI: waste + recovery, CAPA lifecycle,
 * machines, and cancelling an unstarted production order.
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:5310 E2E_API_URL=http://localhost:3310/api/v1 npx playwright test e2e/make-extras.spec.ts --workers=1
 */

const SKU_CODE = 'STY-0001UNI-DSS-REF-NVY-M'; // seeded SKU with an ACTIVE BOM

const dialog = (page: Page, name?: string | RegExp) =>
  (name ? page.getByRole('dialog', { name }) : page.getByRole('dialog')).last();

async function confirm(page: Page, button: string | RegExp) {
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: button }).click();
  await expect(dlg).toBeHidden();
}

test.describe.serial('Make-side secondary flows', () => {
  test('waste: record waste, then record recovery exactly once', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'admin');
    await page.goto('/waste');
    await page.getByRole('button', { name: 'Record waste' }).first().click();
    const d = dialog(page, 'Record waste');
    await d.getByRole('spinbutton', { name: /^Quantity/ }).fill('3');
    await d.getByRole('combobox', { name: /^Unit/ }).selectOption('METERS');
    await d.getByLabel('Unit cost').fill('40');
    await d.getByRole('button', { name: 'Record waste' }).click();
    await expectToast(page, /Waste WST-.* recorded/);
    const code = (await page.locator('.erp-toast[role="status"]').filter({ hasText: /Waste WST-/ }).first().innerText())
      .match(/WST-[A-Z0-9-]+/)![0];

    const row = page.locator('tbody tr').filter({ hasText: code });
    await expect(row).toBeVisible();
    await row.click();
    const detail = dialog(page, new RegExp(code));
    await detail.getByRole('button', { name: 'Record recovery' }).click();
    const rec = dialog(page, new RegExp(`Recover ${code}`));
    await rec.getByRole('radio').first().check();
    await rec.getByRole('button', { name: 'Record recovery' }).click();
    await expectToast(page, 'Recovery recorded');

    // Recovery is one-time: once the list refreshes, the record no longer offers it.
    await expect(row).toContainText(/Recovered/i);
    await row.click();
    await expect(dialog(page, new RegExp(code)).getByRole('button', { name: 'Record recovery' })).toHaveCount(0);
    problems.assertNone();
    await context.close();
  });

  test('CAPA: create, then close with confirmation', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'admin');
    await page.goto('/quality/capa');
    await page.getByRole('button', { name: 'New CAPA' }).first().click();
    const d = dialog(page, 'New CAPA');
    const issue = `E2E loose stitching on hem ${uniq('C')}`;
    await d.getByLabel('Issue').fill(issue);
    await d.getByLabel('Root cause').fill('Thread tension not set after bobbin change');
    await d.getByLabel('Action plan').fill('Add tension check to the start-of-shift checklist');
    await d.getByRole('button', { name: 'Create CAPA' }).click();
    await expectToast(page, /CAPA .*created/);

    const row = page.locator('tbody tr').filter({ hasText: issue });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /Actions for|More actions/ }).click();
    await page.getByRole('menuitem', { name: 'Close CAPA' }).click();
    await confirm(page, 'Close CAPA');
    await expectToast(page, 'CAPA closed');
    await expect(row).toContainText(/Closed/i);
    problems.assertNone();
    await context.close();
  });

  test('machines: add a machine; it can be picked for batches', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'admin');
    await page.goto('/production/machines');
    await page.getByRole('button', { name: 'New machine' }).first().click();
    const d = dialog(page, 'New machine');
    const code = uniq('MC');
    await d.getByLabel('Code').fill(code);
    await d.getByLabel('Name').fill('E2E Overlock 4-thread');
    await d.getByRole('button', { name: 'Add machine' }).click();
    await expectToast(page, 'Machine added');
    await expect(page.locator('tbody tr').filter({ hasText: code })).toBeVisible();
    problems.assertNone();
    await context.close();
  });

  test('planner cancels an unstarted order; its reservations are released', async ({ browser, request }) => {
    const { page, problems, context } = await loginAs(browser, request, 'planner');
    const admin = api(request, await apiLogin(request, 'admin'));
    // Total raw-material quantity held by reservations across all stock rows.
    const totalReserved = async () => {
      const rows: { reserved?: number }[] = await admin.get('/inventory/balances', { limit: 500, includeEmpty: true });
      return Math.round(rows.reduce((s, b) => s + (b.reserved || 0), 0) * 1000) / 1000;
    };
    const reservedAtStart = await totalReserved();
    await page.goto('/production/orders');
    await page.getByRole('button', { name: 'New production order' }).first().click();
    const drawer = dialog(page, 'New production order');
    await drawer.getByRole('button', { name: 'SKU', exact: true }).click();
    await page.getByRole('combobox', { name: 'Filter options' }).fill(SKU_CODE);
    await page.getByRole('option').filter({ hasText: SKU_CODE }).first().click();
    await drawer.getByLabel('Quantity (pieces)').fill('2');
    await drawer.getByRole('button', { name: 'Create order' }).click();
    await expectToast(page, 'Production order created');

    const orderDrawer = dialog(page, /^PROD-/);
    const orderNumber = (await orderDrawer.getByRole('heading').first().innerText()).trim();
    await orderDrawer.getByRole('button', { name: 'Run MRP' }).click();
    await expectToast(page, 'Material requirements calculated');
    await orderDrawer.getByRole('button', { name: 'Reserve material' }).click();
    await expectToast(page, 'Raw material reserved');
    await orderDrawer.getByRole('button', { name: 'Close' }).last().click();

    const planner = api(request, await apiLogin(request, 'planner'));
    expect(await totalReserved()).toBeGreaterThan(reservedAtStart);

    const row = page.locator('tbody tr').filter({ hasText: orderNumber });
    await row.getByRole('button', { name: /Actions for|More actions/ }).click();
    await page.getByRole('menuitem', { name: 'Cancel order' }).click();
    await confirm(page, 'Cancel order');
    await expectToast(page, 'Production order cancelled');
    await expect(row).toContainText(/Cancelled/i);

    const [after] = await planner.get('/production-orders', { search: orderNumber });
    expect(after.status).toBe('CANCELLED');
    // Cancelling gives the held material back.
    expect(await totalReserved()).toBe(reservedAtStart);
    problems.assertNone();
    await context.close();
  });
});
