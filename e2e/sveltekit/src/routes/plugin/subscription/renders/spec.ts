import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('subscription preprocessor', () => {
  test('onError hook', async ({ page }) => {
    await goto(page, routes.Plugin_subscription_renders);
    await expectToBe(page, 'hello');
  });
});
