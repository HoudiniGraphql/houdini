import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectToBe } from '../../lib/utils/testsHelper.js';

test.describe('ssr-one-store-multivariables Page', () => {
  test('Getting the right data in a network mode (CSR)', async ({ page }) => {
    await page.goto(routes.Stores_Network_One_Store_Multivariables);

    await expectToBe(page, 'store-multi-user:1 - Bruce Willis');
    await expectToBe(page, 'store-multi-user:5 - Will Smith', 'div[id=result-5]');
  });
});
