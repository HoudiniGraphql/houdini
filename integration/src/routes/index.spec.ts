import { routes } from '../lib/utils/routes.js';
import { expect, test } from '@playwright/test';

test('Integration has the right title, we can start 🚀', async ({ page }) => {
  await page.goto(routes.Home);
  expect(await page.textContent('h1')).toBe('Welcome to Houdini Interation tests');
});
