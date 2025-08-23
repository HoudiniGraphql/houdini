import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto_expect_n_gql } from '../../../lib/utils/testsHelper.js';

test.describe('network-one-store-multivariables Page', () => {
  test('Getting the right data in a network mode (CSR)', async ({ page }) => {
    await goto_expect_n_gql(page, routes.Stores_Network_One_Store_Multivariables, 2);

    await expect_to_be(page, 'store-multi-user:1 - Bruce Willis');
    await expect_to_be(page, 'store-multi-user:5 - Will Smith', 'div[id=result-5]');
  });
});
