import { test } from '@playwright/test';
import { sleep } from '@kitql/helpers';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../lib/utils/testsHelper.js';

test('happy path updates', async ({ page }) => {
  await goto(page, routes.subscriptions_two_subscriptions);

  // click on one of the button to ensure we're not listening
  await page.click('#mutate-foo');
  await expect_to_be(page, 'undefined,undefined');

  // test only one active
  await page.click('#listen-1');
  await page.click('#mutate-foo');
  await sleep(100);
  await expect_to_be(page, '"foo",undefined');
  await page.click('#mutate-bar');
  await sleep(100);
  await expect_to_be(page, '"bar",undefined');

  // test both active
  await page.click('#listen-2');
  await page.click('#mutate-foo');
  await sleep(100);
  await expect_to_be(page, '"foo","foo"');
  await page.click('#mutate-bar');
  await sleep(100);
  await expect_to_be(page, '"bar","bar"');

  // unlisten to one and mutate
  await page.click('#unlisten-1');
  await page.click('#mutate-foo');
  await sleep(100);
  await expect_to_be(page, '"bar","foo"');
  await page.click('#mutate-bar');
  await sleep(100);
  await expect_to_be(page, '"bar","bar"');

  // unlisten to two and mutate
  await page.click('#unlisten-2');
  await page.click('#mutate-foo');
  await sleep(100);
  await expect_to_be(page, '"bar","bar"');
  await page.click('#mutate-bar');
  await sleep(100);
  await expect_to_be(page, '"bar","bar"');
});
