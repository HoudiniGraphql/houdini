import { routes } from '../../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe
} from '../../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('Fragment Preprocessor', () => {
  test('updates with parent store', async ({ page }) => {
    await page.goto(routes.Plugin_fragment_update);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'Bruce Willis');

    // load the new data
    await expectGraphQLResponse(page, 'button[id=refetch]');

    // make sure the fragment store updated
    await expectToBe(page, 'Samuel Jackson');
  });
});
