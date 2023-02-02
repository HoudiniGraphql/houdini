import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../lib/utils/testsHelper.js';

test.describe('ssr-one-store-multivariables Page', () => {
  test('Getting the right data in a network mode (CSR)', async ({ page }) => {
    await goto(page, routes.Stores_SSR_One_Store_Multivariables);

    await expect_to_be(page, 'store-multi-user:1 - Bruce Willis');
    await expect_to_be(page, 'store-multi-user:5 - Will Smith', 'div[id=result-5]');
  });

  test('loadAll should brings correct types', async ({ page }) => {
    await goto(page, routes.Stores_SSR_One_Store_Multivariables);

    await expect_to_be(page, 'true - true - false', 'div[id=result-types]');
  });
});
