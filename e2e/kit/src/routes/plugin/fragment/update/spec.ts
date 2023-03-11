import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_1_gql, expect_to_be, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('Fragment Preprocessor', () => {
  test('updates with parent store', async ({ page }) => {
    await goto(page, routes.Plugin_fragment_update);

    await expect_to_be(page, 'Bruce Willis');

    // load the new data
    await expect_1_gql(page, 'button[id=refetch]');

    // make sure the fragment store updated
    await expect_to_be(page, 'Samuel Jackson');
  });
});
