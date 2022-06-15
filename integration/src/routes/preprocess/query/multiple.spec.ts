import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe } from '../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('multiple queries', async ({ page }) => {
    await page.goto(routes.Preprocess_query_multiple);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'Bruce Willis', 'div[id=result1]');

    await expectToBe(page, 'Samuel Jackson', 'div[id=result2]');
  });
});
