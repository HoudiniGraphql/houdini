import { test } from '@playwright/test';
import { routes } from '../../../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await goto(page, routes.Plugin_query_layout);

    await expectToBe(page, 'Bruce Willis');
  });
});
