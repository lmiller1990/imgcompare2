import { test, expect } from '@playwright/test';

test('has content', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Hello world')).toBeVisible();
});