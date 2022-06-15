import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectElementToBe, expectGraphQLResponse } from '../../lib/utils/testsHelper.js';

test.describe('SSR Session Page', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_Network_Session);

    await expectGraphQLResponse(page, 'button[id=getToken]');

    await expectElementToBe(page, '1234-Houdini-Token-5678');
  });
});
