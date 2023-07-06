import { test } from '@playwright/test';
import { sleep } from '@kitql/helper';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../lib/utils/testsHelper.js';

test('happy path updates', async ({ page }) => {
  await goto(page, routes.subscriptions_happyPath);

  // validate the contents
  await expect_to_be(page, 'Bruce Willis');

  // start listening
  await page.click('#listen');
  await sleep(100);
  await expect_to_be(page, 'true', '#fetching');

  // set the name to foo
  await page.click('#mutate-foo');

  await sleep(100);

  // validate the contents
  await expect_to_be(page, 'foo');

  // stop listening
  await page.click('#unlisten');
  await sleep(100);
  await expect_to_be(page, 'false', '#fetching');
});
