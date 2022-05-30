import { expect, test } from '@playwright/test';

test('Integration has the right title, we can start 🚀', async ({ page }) => {
  await page.goto('/');
  expect(await page.textContent('h1')).toBe('Welcome to Houdini Interation tests');
});
