import { expect, test } from '@playwright/test';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.ts';
import { routes } from '../../../lib/utils/routes.ts';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await page.goto('/preprocess/query/simple');

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    const div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');
  });

  test('happy path query - Network', async ({ page }) => {
    await page.goto(routes.Home);
    await page.goto('/preprocess/query/simple');

    const result = await expectGraphQLResponse(page);
    expect(result).toBe('{"data":{"user":{"id":"1","name":"Bruce Willis"}}}');

    const div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');
  });
});
