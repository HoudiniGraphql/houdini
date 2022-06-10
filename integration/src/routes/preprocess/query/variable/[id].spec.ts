import { expect, test } from '@playwright/test';
import {
  clientSideNavigation,
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  navSelector
} from '../../../../lib/utils/testsHelper.js';
import { routes } from '../../../../lib/utils/routes.js';

test.describe('query preprocessor variables', () => {
  test('default value', async ({ page }) => {
    await page.goto(routes.Preprocess_query_variable_1);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis');

    // We should have the data without a GraphQL request in the client
    await expectGraphQLResponse(page, navSelector(routes.Preprocess_query_variable_2));

    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Samuel Jackson');
  });
});
