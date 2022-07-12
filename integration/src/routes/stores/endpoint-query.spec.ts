import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe } from '../../lib/utils/testsHelper.js';

test.describe('query endpoint', () => {
  test('happy path query ', async ({ page }) => {
    await page.goto(routes.Stores_Endpoint_Query);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, JSON.stringify({ hello: 'Hello World! // From Houdini!' }));
  });
});
