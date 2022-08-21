import { routes } from '../../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe } from '../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('query endpoint', () => {
  test('happy path query ', async ({ page }) => {
    await page.goto(routes.Stores_Endpoint_Query);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, JSON.stringify({ data: { hello: 'Hello World! // From Houdini!' } }));
  });
});
