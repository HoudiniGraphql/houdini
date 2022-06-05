import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('multiple queries', async ({ page }) => {
    await page.goto(routes.Preprocess_query_multiple);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    const div1 = await page.locator('div[id=result1]').textContent();
    expect(div1).toBe('Bruce Willis');

    const div2 = await page.locator('div[id=result2]').textContent();
    expect(div2).toBe('Samuel Jackson');
  });
});
