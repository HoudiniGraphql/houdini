import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../lib/utils/testsHelper.js';
import { sleep } from '@kitql/helpers';

test("Components without load shouldn't subscribe to the cache", async ({ page }) => {
  await goto(page, routes.Stores_Component_no_load_no_setup);

  await expect_to_be(page, 'null');

  // click on the button
  await page.click('#load2');

  await sleep(100);

  // make sure we still have null as the value
  await expect_to_be(page, 'null');
});
