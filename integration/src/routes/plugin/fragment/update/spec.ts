import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectToBe, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('Fragment Preprocessor', () => {
  test('updates with parent store', async ({ page }) => {
    await goto(page, routes.Plugin_fragment_update);

    await expectToBe(page, 'Bruce Willis');

    // load the new data
    await expectGraphQLResponse(page, 'button[id=refetch]');

    // make sure the fragment store updated
    await expectToBe(page, 'Samuel Jackson');
  });
});
