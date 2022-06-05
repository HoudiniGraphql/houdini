import { expect, test } from '@playwright/test';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  clientSideNavigation,
  navSelector
} from '../../../lib/utils/testsHelper.js';
import { routes } from '../../../lib/utils/routes.js';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await page.goto(routes.Preprocess_query_simple);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    const div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');
  });

  test('happy path query - Network', async ({ page }) => {
    // Go to home
    await page.goto(routes.Home);

    const result = await expectGraphQLResponse(page, navSelector(routes.Preprocess_query_simple));
    expect(result).toBe('{"data":{"user":{"id":"1","name":"Bruce Willis"}}}');

    const div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');
  });
});
