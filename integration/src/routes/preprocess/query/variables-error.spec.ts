import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectToBe } from '../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('variables this.error', async ({ page }) => {
    await page.goto(routes.Preprocess_query_variable_error);
    await expectToBe(page, '403: test', 'h1');
  });
});
