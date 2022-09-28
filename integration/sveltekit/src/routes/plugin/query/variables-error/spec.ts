import { routes } from '../../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('query preprocessor', () => {
  test('variables this.error', async ({ page }) => {
    await goto(page, routes.Plugin_query_variable_error);
    await expectToBe(page, '403: test', 'h1');
  });
});
