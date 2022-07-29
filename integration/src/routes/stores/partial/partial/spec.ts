import { sleep } from '@kitql/helper';
import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { clientSideNavigation, expectToBe } from '../../../lib/utils/testsHelper.js';

test.describe('Partial Pages', () => {
  test('From the list to the detail should see 2 info then the date coming', async ({ page }) => {
    // Go to the list
    await page.goto(routes.Stores_Partial_List);

    // We should have the list
    expectToBe(
      page,
      'Full Light Partial:1 - Bruce Willis Full Light Partial:2 - Samuel Jackson Full Light Partial:3 - Morgan Freeman Full Light Partial:4 - Tom Hanks'
    );

    // Go on the light page 2
    await page.locator('a[id="l_2"]').click();

    // Wait a bit so that the server respond with 2 fields
    await sleep(2345);

    // Check that we have 2 fields
    expectToBe(page, 'Partial:2', 'div[id="id"]');
    expectToBe(page, 'Samuel Jackson', 'div[id="name"]');

    // go back to the list
    await clientSideNavigation(page, routes.Stores_Partial_List);

    // Go on the light page 2 FULL
    await page.locator('a[id="f_2"]').click();

    // Click on the link and check directly the 3 divs
    expectToBe(page, 'Partial:2', 'div[id="id"]');
    expectToBe(page, 'Samuel Jackson', 'div[id="name"]');
    expectToBe(page, 'undefined', 'div[id="birthDate"]');

    // Wait a bit so that the server respond and birthDate is displayed
    await sleep(2345);
    expectToBe(page, '1948-12-21T00:00:00.000Z', 'div[id="birthDate"]');
  });
});
