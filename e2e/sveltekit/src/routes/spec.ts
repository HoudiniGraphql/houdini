import { test } from '@playwright/test';
import { routes } from '../lib/utils/routes.js';
import { expectToBe, goto } from '../lib/utils/testsHelper.js';

test('Integration has the right title, we can start 🚀', async ({ page }) => {
  await goto(page, routes.Home);
  await expectToBe(page, 'Welcome to Houdini Interation tests', 'h1');
});

test.describe('Layout & comp', () => {
  test('Root layout can have query with session', async ({ page }) => {
    await goto(page, routes.Home);

    // make sure that the session value has something
    await expectToBe(page, '1234-Houdini-Token-5678', '#layout-session');
  });
});
