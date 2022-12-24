import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('query variables from route params', () => {
  test('happy path', async ({ page }) => {
    await goto(page, routes.Plugin_query_userRoute_params);

    await expectToBe(page, 'Bruce Willis');
  });
});
