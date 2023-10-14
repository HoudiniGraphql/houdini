import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../lib/utils/testsHelper.js';

test.describe('ssr-loadall-store-without-variables Page', () => {
  test('loadAll should brings correct types', async ({ page }) => {
    await goto(page, routes.Stores_SSR_LoadAll_Store_Without_Variables);

    await expect_to_be(page, 'true', 'div[id=result-types]');
  });
});
