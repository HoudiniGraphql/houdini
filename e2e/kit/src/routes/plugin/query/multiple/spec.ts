import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('multiple queries', async ({ page }) => {
    await goto(page, routes.Plugin_query_multiple);

    await expect_to_be(page, 'Bruce Willis', 'div[id=result1]');

    await expect_to_be(page, 'Samuel Jackson', 'div[id=result2]');
  });
});
