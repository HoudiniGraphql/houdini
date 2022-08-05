import { routes } from '../../../lib/utils/routes.js';
import { expectToBe, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('SSR Session Page', () => {
  test('No GraphQL request & Should display the session token', async ({ page }) => {
    await page.goto(routes.Stores_SSR_Session);

    await expectNoGraphQLRequest(page);

    await expectToBe(page, '1234-Houdini-Token-5678');
  });
});
