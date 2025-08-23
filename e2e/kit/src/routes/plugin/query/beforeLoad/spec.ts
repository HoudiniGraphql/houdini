import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await goto(page, routes.Plugin_query_beforeLoad);

    await expect_to_be(page, 'hello: Bruce Willis');
  });
});
