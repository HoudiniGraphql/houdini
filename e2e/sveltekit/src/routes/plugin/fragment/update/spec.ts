import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_1_gql, expectToBe, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('Fragment Preprocessor', () => {
  test('updates with parent store', async ({ page }) => {
    await goto(page, routes.Plugin_fragment_update);

    await expectToBe(page, 'Bruce Willis');

    // load the new data
    await expect_1_gql(page, 'button[id=refetch]');

    // make sure the fragment store updated
    await expectToBe(page, 'Samuel Jackson');
  });
});
