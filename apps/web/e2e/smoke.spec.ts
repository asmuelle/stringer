import { expect, test } from '@playwright/test';

test('morning brief renders with masthead, verified quotes, and coverage footer', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('EU AI regulation');
  await expect(page.locator('.pull-quote').first()).toBeVisible();
  await expect(page.locator('.coverage-line').first()).toContainText('Checked 10 sources');
});
