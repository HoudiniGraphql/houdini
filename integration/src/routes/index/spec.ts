import { routes } from '../../lib/utils/routes.js';
import { expectToBe } from '../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test('Integration has the right title, we can start 🚀', async ({ page }) => {
  await page.goto(routes.Home);
  await expectToBe(page, 'Welcome to Houdini Interation tests', 'h1');
});
