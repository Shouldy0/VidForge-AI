import { test, expect } from '@playwright/test';

test.describe('Generate Flow', () => {
  test('should generate episode', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/dashboard/);
    await page.click('a:has-text("Generate Episode")');
    await page.fill('textarea[name="prompt"]', 'Test episode about AI');
    await page.click('button:has-text("Generate")');
    await expect(page).toHaveURL(/studio/);
  });
});
