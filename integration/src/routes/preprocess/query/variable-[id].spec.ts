import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe,
  navSelector
} from '../../../lib/utils/testsHelper.js';

test.describe('query preprocessor variables', () => {
  test('default value', async ({ page }) => {
    await page.goto(routes.Preprocess_query_variable_1);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'Bruce Willis');

    // We should have the data with only 1 GraphQL request in the client
    await expectGraphQLResponse(page, navSelector(routes.Preprocess_query_variable_2));

    await expectToBe(page, 'Samuel Jackson');
  });
});
