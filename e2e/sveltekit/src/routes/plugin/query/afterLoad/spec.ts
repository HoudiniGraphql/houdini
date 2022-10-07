import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('afterLoad hook', async ({ page }) => {
    await goto(page, routes.Plugin_query_afterLoad);

    await expectToBe(page, 'B: Bruce Willis');
  });
});
