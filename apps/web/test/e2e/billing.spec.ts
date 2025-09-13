import { test, expect } from '@playwright/test';

test.describe('Billing Flow', () => {
  test('should handle billing settings', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/dashboard/);
    await page.click('a:has-text("Settings")');
    await page.click('a:has-text("Billing")');
    await expect(page.locator('text=Current Plan')).toBeVisible();
    await page.click('button:has-text("Upgrade")');
    await expect(page).toHaveURL(/checkout.stripe.com/);
  });
});
