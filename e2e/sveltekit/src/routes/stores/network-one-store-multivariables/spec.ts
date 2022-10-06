import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes';
import { expectToBe, goto_expect_n_gql } from '../../../lib/utils/testsHelper';

test.describe('network-one-store-multivariables Page', () => {
  test('Getting the right data in a network mode (CSR)', async ({ page }) => {
    await goto_expect_n_gql(page, routes.Stores_Network_One_Store_Multivariables, 2);

    await expectToBe(page, 'store-multi-user:1 - Bruce Willis');
    await expectToBe(page, 'store-multi-user:5 - Will Smith', 'div[id=result-5]');
  });
});
