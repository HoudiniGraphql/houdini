import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import { expectToBe, goto } from '../../../../lib/utils/testsHelper';

test.describe('query preprocessor', () => {
  test('afterLoad hook', async ({ page }) => {
    await goto(page, routes.Plugin_query_afterLoad);

    await expectToBe(page, 'B: Bruce Willis');
  });
});
