import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';

test.describe('Fragment Preprocessor', () => {
  test('updates with parent store', async ({ page }) => {
    await page.goto(routes.Preprocess_fragment_update);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toEqual('Bruce Willis');

    // load the new data
    await expectGraphQLResponse(page, 'button[id=refetch]');

    // make sure the fragment store updated
    div = await page.locator('div[id=result]').textContent();
    expect(div).toEqual('Samuel Jackson');
  });
});
