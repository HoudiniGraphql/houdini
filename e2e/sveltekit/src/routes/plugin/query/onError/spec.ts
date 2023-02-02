import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { clientSideNavigation, expect_to_be, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('onError hook', async ({ page }) => {
    await goto(page, routes.Plugin_query_onError);

    await expect_to_be(page, 'hello,User not found.');
  });

  test('onError hook blocks on client', async ({ page }) => {
    await goto(page, routes.Home);
    await clientSideNavigation(page, routes.Plugin_query_onError);

    await expect_to_be(page, 'hello,User not found.');
  });
});
