import { routes } from '../../../../lib/utils/routes.js';
import { expect, test } from '@playwright/test';
import { expectGraphQLResponse, clientSideNavigation } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor variables', () => {
  test('can include stuff', async ({ page }) => {
    // set a context value
    await page.goto(routes.Stuff_set_user_1);

    // TODO JYC & Alec: to check together?
    clientSideNavigation(page, routes.Preprocess_query_variable_stuff);

    // We should have the data without a GraphQL Response in the client
    await expectGraphQLResponse(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');
  });
});
