import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectGraphQLResponse, expectToBe } from '../../lib/utils/testsHelper.js';

test.describe('SSR Session Page', () => {
  test('Should display the session token from a network call', async ({ page }) => {
    await page.goto(routes.Stores_Network_Session);

    await expectGraphQLResponse(page, 'button[id=getToken]');

    await expectToBe(page, '1234-Houdini-Token-5678');
  });
});
