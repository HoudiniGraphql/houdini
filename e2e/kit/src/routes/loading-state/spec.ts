import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { clientSideNavigation, expect_to_be, goto } from '../../lib/utils/testsHelper.js';

// in order to see the loading state we need to navigate there as CSR
test('loading state', async ({ page }) => {
  // start at the home page
  await goto(page, routes.Home);

  // navigate to the loading state page
  await clientSideNavigation(page, routes.loading_state);

  // make sure we see the loading state value
  await expect_to_be(page, 'loading!');
});
