import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expectGraphQLResponse, navSelector } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor variables', () => {
  test('can include stuff', async ({ page }) => {
    // set a context value
    await page.goto(routes.Stuff_set_user_1);

    // We should have the data without a GraphQL Response in the client
    await expectGraphQLResponse(page, navSelector(routes.Preprocess_query_variable_stuff));

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');
  });
});
