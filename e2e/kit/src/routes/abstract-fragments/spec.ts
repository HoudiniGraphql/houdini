import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../lib/utils/testsHelper.js';

test('abstract fragment on concrete parent', async ({ page }) => {
  await goto(page, routes.abstractFragments);
  await expect_to_be(page, '1,2');
});
