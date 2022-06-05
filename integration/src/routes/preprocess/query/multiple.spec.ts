import { expect, test } from '@playwright/test';
import {
  clientSideNavigation,
  expectGraphQLResponse,
  expectNoGraphQLRequest
} from '../../../lib/utils/testsHelper.ts';
import { routes } from '../../../lib/utils/routes.ts';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await page.goto(routes.Preprocess_query_simple);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    const div1 = await page.locator('div[id=result1]').textContent();
    expect(div1).toBe('Bruce Willis');

    const div2 = await page.locator('div[id=result2]').textContent();
    expect(div2).toBe('Samuel Jackson');
  });
});
