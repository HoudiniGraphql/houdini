import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('subscription preprocessor', () => {
  test('onError hook', async ({ page }) => {
    await goto(page, routes.Plugin_subscription_renders);
    await expect_to_be(page, 'hello');
  });
});
