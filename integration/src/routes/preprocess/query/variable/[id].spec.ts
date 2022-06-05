import { expect, test } from '@playwright/test';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest
} from '../../../../lib/utils/testsHelper.ts';

test.describe('query preprocessor variables', () => {
  test('default value', async ({ page }) => {
    await page.goto('/preprocess/query/variables/1');

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');

    await page.goto('/preprocess/query/variables/2');

    // We should have the data without a GraphQL request in the client
    await expectGraphQLResponse(page);

    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Samuel Jackson');
  });
});
