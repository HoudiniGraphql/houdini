import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../lib/utils/testsHelper.js';

test.describe('fragment store', function () {
  test('accepts and returns null values', async function ({ page }) {
    await goto(page, routes.Stores_Fragment_Null);

    // make sure that the result updated with unmarshaled data
    await expect_to_be(page, 'null');
  });
});
