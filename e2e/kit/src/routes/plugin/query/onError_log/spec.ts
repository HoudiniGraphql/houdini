import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { clientSideNavigation, goto, waitForConsole } from '../../../../lib/utils/testsHelper.js';

test.describe('onError_log', () => {
  test('onError console.error because not blocking', async ({ page }) => {
    await goto(page, routes.Home);

    const [msg] = await Promise.all([
      waitForConsole(page, 'error'),
      clientSideNavigation(page, routes.Plugin_query_onError_log)
    ]);

    expect(msg.text()).toBe(
      '[Houdini][client-plugin] throwOnError can work properly only if you block the query (by config or directive or args)'
    );
  });
});
