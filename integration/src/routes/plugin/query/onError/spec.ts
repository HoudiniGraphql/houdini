import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { clientSideNavigation, expectToBe, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('onError hook', async ({ page }) => {
    await goto(page, routes.Plugin_query_onError);

    await expectToBe(page, 'hello');
  });

  test('onError hook', async ({ page }) => {
    await goto(page, routes.Home);
    await clientSideNavigation(page, routes.Plugin_query_onError);

    await expectToBe(page, 'hello');
  });
});
