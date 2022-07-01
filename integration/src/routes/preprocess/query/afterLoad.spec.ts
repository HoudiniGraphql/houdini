import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe } from '../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('afterLoad hook', async ({ page }) => {
    await page.goto(routes.Preprocess_query_afterLoad);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'B: Bruce Willis');
  });
});
