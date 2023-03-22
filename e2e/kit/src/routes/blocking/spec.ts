import { sleep } from '@kitql/helper';
import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  clientSideNavigation,
  expect_1_gql,
  expect_to_be,
  goto
} from '../../lib/utils/testsHelper.js';

test.describe('blocking', () => {
  test('CSR no_blocking', async ({ page }) => {
    await goto(page, routes.blocking);

    // click on the link
    await clientSideNavigation(page, '/blocking/query_with_no_blocking');

    // should move to the next page with the right h2
    const h2 = await page.innerText('h2');
    expect(h2).toBe('query_with_no_blocking');

    // we should have no data
    await expect_to_be(page, 'undefined-undefined');

    // the delay is 1000, let's wait a bit more
    await sleep(1500);

    // check that we have data now
    await expect_to_be(page, 'with_no_blocking:1-Bruce Willis');
  });

  test('CSR blocking', async ({ page }) => {
    await goto(page, routes.blocking);

    // click on the link
    await clientSideNavigation(page, '/blocking/query_with_blocking');

    // should NOT move to the next page as the query will block the navigation for 1000ms
    // so h2 should still be 'blocking'
    const h2 = await page.innerText('h2');
    expect(h2).toBe('blocking');

    // the delay is 1000, let's wait a bit more
    await sleep(1500);

    // check that we have data now
    await expect_to_be(page, 'with_blocking:1-Bruce Willis');
  });
});
