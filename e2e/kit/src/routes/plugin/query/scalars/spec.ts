import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_to_be,
  goto,
  navSelector,
  clientSideNavigation,
  expect_0_gql
} from '../../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('query preprocessor variables', () => {
  test('query values get unmarshaled into complex values', async function ({ page }) {
    await goto(page, routes.Plugin_query_scalars);
    await clientSideNavigation(page, routes.Home);

    // We want the query in the frontend, so we navigate to the page
    // to zoom on scalar test & data
    await expect_0_gql(page, navSelector(routes.Plugin_query_scalars));

    // ISO compare to not have timezone issues
    await expect_to_be(page, '1955-03-19T00:00:00.000Z', 'div[id=result-date]');
  });
});
