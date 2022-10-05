import { routes } from '../../lib/utils/routes';
import { expectToBe, goto } from '../../lib/utils/testsHelper';
import { test } from '@playwright/test';

test('Integration has the right title, we can start 🚀', async ({ page }) => {
  await goto(page, routes.Home);
  await expectToBe(page, 'Welcome to Houdini Interation tests', 'h1');
});
