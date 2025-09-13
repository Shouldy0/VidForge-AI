import { test, expect } from '@playwright/test';

test.describe('Render Flow', () => {
  test('should render episode', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/dashboard/);
    // Go to studio (assume from previous or direct)
    await page.goto('/studio/test-episode');
    await page.click('button:has-text("Render")');
    await expect(page.locator('.render-success')).toBeVisible();
  });
});
