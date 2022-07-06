import { sleep } from '@kitql/helper';
import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectToBe } from '../../../lib/utils/testsHelper.js';

test.describe('Partial Pages', () => {
  test('From the list to the detail should see 2 info then the date coming', async ({ page }) => {
    // Go to the list
    await page.goto(routes.Stores_Partial_List);

    // We should have the list
    expectToBe(
      page,
      'Partial:1 - Bruce Willis Partial:2 - Samuel Jackson Partial:3 - Morgan Freeman Partial:4 - Tom Hanks'
    );

    // Click on the link and check directly the 3 divs
    await page.locator('a[id="2"]').click();
    expectToBe(page, 'Partial:2', 'div[id="id"]');
    expectToBe(page, 'Samuel Jackson', 'div[id="name"]');
    expectToBe(page, 'undefined', 'div[id="birthDate"]');

    // Wait a bit so that the server respond and birthDate is displayed
    sleep(2345);
    expectToBe(page, '1948-12-21T00:00:00.000Z', 'div[id="birthDate"]');
  });
});
