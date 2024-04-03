import test from '@playwright/test';
import { routes } from '../../../lib/utils/routes';
import {
  expect_1_gql,
  expect_to_be,
  goto,
  goto_expect_n_gql,
  navSelector
} from '../../../lib/utils/testsHelper';

test.describe('Svelte 5 runes SSR page', () => {
  test('User name is filled in correctly', async ({ page }) => {
    await goto(page, routes.Svelte5_Runes_Simple_SSR);

    await expect_to_be(page, 'Bruce Willis');
  });

  test('Navigate directly causes 0 client-side queries', async ({ page }) => {
    await goto_expect_n_gql(page, routes.Svelte5_Runes_Simple_SSR, 0);
  });

  test('Navigate from home to page causes 1 client-side query', async ({ page }) => {
    await goto(page, routes.Home);

    await expect_1_gql(page, navSelector(routes.Svelte5_Runes_Simple_SSR));
  });
});
