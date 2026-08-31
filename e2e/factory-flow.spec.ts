import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Login', () => {
  test('shows login form and signs in with demo credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ERP Factory' })).toBeVisible();
    await loginAsAdmin(page);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });
});

test.describe('Seeded demo data @seeded', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('designs page lists Demo Summer Shirt', async ({ page }) => {
    await page.goto('/designs');
    await expect(page.getByRole('heading', { name: /Designs/i })).toBeVisible();
    await expect(page.getByText('Demo Summer Shirt')).toBeVisible({ timeout: 15_000 });
  });

  test('samples page shows approved demo sample', async ({ page }) => {
    await page.goto('/samples');
    await expect(page.getByRole('heading', { name: 'Sampling' })).toBeVisible();
    await expect(page.getByText('APPROVED').first()).toBeVisible({ timeout: 15_000 });
  });

  test('production orders page loads seeded order', async ({ page }) => {
    await page.goto('/production/orders');
    await expect(page.getByRole('heading', { name: 'Production' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Batches' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.erp-card').first()).toBeVisible({ timeout: 15_000 });
  });

  test('pattern development page loads', async ({ page }) => {
    await page.goto('/pattern');
    await expect(page.getByRole('heading', { name: 'Pattern Development' })).toBeVisible({ timeout: 15_000 });
  });
});
