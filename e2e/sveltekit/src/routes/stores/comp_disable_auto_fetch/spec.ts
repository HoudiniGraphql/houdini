import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { clientSideNavigation, goto } from '../../../lib/utils/testsHelper.js';

test('Arriving on the page without data and without an auto fetch (SSR)', async ({ page }) => {
  // We should have 0 query done going to this page in SSR
  await goto(page, routes.Stores_Comp_disable_auto_fetch);

  const pContentIndex = await page.locator('p').allTextContents();
  expect(pContentIndex).toEqual(['QueryExtNoAutoFetch - Number of users: undefined']);
});

test('Arriving on the page without data and without an auto fetch (CSR)', async ({ page }) => {
  await goto(page, routes.Home);
  // We should have 0 query done going to this page in CSR
  await clientSideNavigation(page, routes.Stores_Comp_disable_auto_fetch);

  const pContentIndex = await page.locator('p').allTextContents();
  expect(pContentIndex).toEqual(['QueryExtNoAutoFetch - Number of users: undefined']);
});
