import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe } from '../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await page.goto(routes.Stores_Endpoint);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, JSON.stringify({ hello: 'Hello World! // From Houdini!' }));
  });
});
