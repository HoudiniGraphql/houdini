import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../lib/utils/testsHelper.js';

test.describe('connection-fragment', () => {
  test('SSR load with data', async ({ page }) => {
    // load data in SSR
    await goto(page, routes.Stores_Connection_Fragment);

    // Check data froma fragment that where the parent has no ID
    await expect_to_be(page, 'Bruce Willis, Samuel Jackson');
  });
});
