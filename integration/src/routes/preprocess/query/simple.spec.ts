import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe,
  navSelector
} from '../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await page.goto(routes.Preprocess_query_simple);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'Bruce Willis');
  });

  test('happy path query - Network', async ({ page }) => {
    // Go to home
    await page.goto(routes.Home);

    const result = await expectGraphQLResponse(page, navSelector(routes.Preprocess_query_simple));
    expect(result).toBe(
      '{"data":{"user":{"id":"preprocess-query-simple:1","name":"Bruce Willis"}}}'
    );

    await expectToBe(page, 'Bruce Willis');
  });
});
