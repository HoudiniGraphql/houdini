import { routes } from '../../../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe, goto } from '../../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('query preprocessor', () => {
  test('multiple queries', async ({ page }) => {
    await goto(page, routes.Plugin_query_multiple);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'Bruce Willis', 'div[id=result1]');

    await expectToBe(page, 'Samuel Jackson', 'div[id=result2]');
  });
});
