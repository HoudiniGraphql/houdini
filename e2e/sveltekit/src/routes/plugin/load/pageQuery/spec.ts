import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('happy path query - SSR', async ({ page }) => {
    await goto(page, routes.Plugin_load_pageQuery);

    await expect_to_be(page, 'page-query:1');
  });
});
