import { expect, test } from '@playwright/test';
import { expectGraphQLResponse } from '../../../../lib/utils/testsHelper.ts';

test.describe('query preprocessor variables', () => {
  test('can include stuff', async ({ page }) => {
    // set a context value
    await page.goto('/stuff/set/user/1');

    await page.goto('/preprocess/query/variables/context');

    // We should have the data without a GraphQL Response in the client
    await expectGraphQLResponse(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');
  });
});
