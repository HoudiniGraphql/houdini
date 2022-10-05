import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import { clientSideNavigation, expectToBe, goto } from '../../../../lib/utils/testsHelper';

test.describe('query preprocessor', () => {
  test('onError hook', async ({ page }) => {
    await goto(page, routes.Plugin_query_onError);

    await expectToBe(page, 'hello');
  });

  test('onError hook blocks on client', async ({ page }) => {
    await goto(page, routes.Home);
    await clientSideNavigation(page, routes.Plugin_query_onError);

    await expectToBe(page, 'hello');
  });
});
