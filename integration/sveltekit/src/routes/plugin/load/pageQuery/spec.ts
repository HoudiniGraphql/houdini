import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import { expectToBe, goto } from '../../../../lib/utils/testsHelper';

test.describe('query preprocessor', () => {
  test('happy path query - SSR', async ({ page }) => {
    await goto(page, routes.Plugin_load_pageQuery);

    await expectToBe(page, 'page-query:1');
  });
});
