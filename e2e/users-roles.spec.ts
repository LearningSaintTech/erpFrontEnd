import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Users & Roles @seeded', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('loads users tab and expands a user row', async ({ page }) => {
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Users & Roles' })).toBeVisible();
    await expect(page.getByText('Users').first()).toBeVisible();

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    await expect(page.getByText('Factory role assignments')).toBeVisible({ timeout: 10_000 });
  });

  test('roles tab loads permission matrix without error', async ({ page }) => {
    await page.goto('/users');
    await page.getByRole('button', { name: /Roles/i }).click();
    await expect(page.getByText('FACTORY_ADMIN').first()).toBeVisible({ timeout: 10_000 });

    const firstRoleRow = page.locator('tbody tr').first();
    await firstRoleRow.click();
    await expect(page.getByText(/Module permissions/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Users with this role/i)).toBeVisible();
  });

  test('delegations tab shows factory prompt or list', async ({ page }) => {
    await page.goto('/users');
    await page.getByRole('button', { name: 'Delegations' }).click();
    await expect(
      page.getByText(/delegation/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
