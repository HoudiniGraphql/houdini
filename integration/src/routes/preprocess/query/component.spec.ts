import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectToBe } from '../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('component queries', async ({ page }) => {
    await page.goto(routes.Preprocess_query_component);

    // We should have the data without a GraphQL request in the client
    await expectGraphQLResponse(page, null);

    await expectToBe(page, 'Bruce Willis', 'div[id=result-default');

    await expectToBe(page, 'Samuel Jackson', 'div[id=result-prop]');
  });
});
