import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes';
import { expect_to_be, goto_expect_n_gql } from '../../../lib/utils/testsHelper';

test('Svelte 5 runes component queries', async ({ page }) => {
  // Load the page - component query should be doing 1 query
  await goto_expect_n_gql(page, routes.Svelte5_Runes_Component, 1);

  // Make sure it loads the correct data
  await expect_to_be(page, 'Samuel Jackson');
});
