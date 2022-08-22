import { routes } from '../../../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe, goto } from '../../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await goto(page, routes.Plugin_query_beforeLoad);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'hello: Bruce Willis');
  });
});
