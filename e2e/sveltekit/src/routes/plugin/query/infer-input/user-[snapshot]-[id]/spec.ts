import { test } from '@playwright/test';
import { routes } from '../../../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../../../lib/utils/testsHelper.js';

test.describe('query variables from route params', () => {
  test('happy path', async ({ page }) => {
    await goto(page, routes.Plugin_query_inferInput_userRoute_params);

    await expect_to_be(page, 'Bruce Willis');
  });
});
