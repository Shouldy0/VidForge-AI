import { test, expect } from '@playwright/test';

test.describe('Publish Flow (Mock)', () => {
  test('should publish episode with mock', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/dashboard/);
    await page.goto('/studio/test-episode');
    await page.click('button:has-text("Publish")');
    // Mock: select mock platform
    await page.click('button:has-text("Mock Platform")');
    await expect(page.locator('.publish-success')).toBeVisible();
  });
});
