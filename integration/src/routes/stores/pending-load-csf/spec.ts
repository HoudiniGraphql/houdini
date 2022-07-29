import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  clientSideNavigation,
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe
} from '../../lib/utils/testsHelper.js';

test('Simultaneous Pending Load and CSF', async ({ page }) => {
  // start off on any page (/stores/network)
  await page.goto(routes.Stores_Network);

  // go to a page with both loads (should also have a clickable thing)
  await clientSideNavigation(page, routes.Stores_SSR_UserId_2);

  // we should have gotten a response from the navigation
  await expectGraphQLResponse(page);

  // make sure we get a response if we click on the button
  await expectGraphQLResponse(page, 'button[id="refresh-1"]');
});
