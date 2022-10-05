import { routes } from '../../../../lib/utils/routes';
import {
  clientSideNavigation,
  expectToBe,
  goto,
  locator_click
} from '../../../../lib/utils/testsHelper';
import { sleep } from '@kitql/helper';
import { test } from '@playwright/test';

test.describe('Partial Pages', () => {
  // Note that the query has a delay (1000ms) to show the behavior.
  // We have to introduce sleep here and there to make sure that client side navigation happend.

  test('From the list to the detail should see 2 info then the date coming', async ({ page }) => {
    // Go to the list
    await goto(page, routes.Stores_Partial_List);

    // Go on the page 2: LIGHT
    await locator_click(page, 'a[id="l_2"]');

    // Wait a bit so that the server respond with 2 fields
    await sleep(2345);

    // Check that we have 2 fields
    expectToBe(page, 'Partial:2', 'div[id="id"]');
    expectToBe(page, 'Samuel Jackson', 'div[id="name"]');

    // go back to the list
    await clientSideNavigation(page, routes.Stores_Partial_List);

    // Go on the page 2: FULL
    await locator_click(page, 'a[id="f_2"]');

    // Click on the link and check directly the 3 divs
    expectToBe(page, 'Partial:2', 'div[id="id"]');
    expectToBe(page, 'Samuel Jackson', 'div[id="name"]');
    expectToBe(page, 'undefined', 'div[id="birthDate"]');

    // Wait a bit so that the server respond and birthDate is displayed
    await sleep(2345);
    expectToBe(page, '1948-12-21T00:00:00.000Z', 'div[id="birthDate"]');
  });
});
