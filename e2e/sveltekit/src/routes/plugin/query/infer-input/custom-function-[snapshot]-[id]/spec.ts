import { test } from '@playwright/test';
import { routes } from '../../../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../../../lib/utils/testsHelper.js';

test.describe('query variables from route params', () => {
  test('custom function', async ({ page }) => {
    await goto(page, routes.Plugin_query_inferInput_customFunction);

    await expectToBe(page, 'Samuel Jackson');
  });
});
