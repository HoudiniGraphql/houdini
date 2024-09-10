import { sleep } from '@kitql/helpers';
import test, { expect, type Response } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_1_gql, expect_to_be, goto } from '../../../../lib/utils/testsHelper.js';

test('pagination before previous request was finished', async ({ page }) => {
  await goto(page, routes.Pagination_query_dedupe_pagination_fetch);

  await expect_to_be(page, 'Bruce Willis, Samuel Jackson');

  // Adapted from `expect_n_gql` in lib/utils/testsHelper.ts
  let nbResponses = 0;
  async function fnRes(response: Response) {
    if (response.url().endsWith(routes.GraphQL)) {
      nbResponses++;
    }
  }

  page.on('response', fnRes);

  // Click the "next page" button twice
  await page.click('button[id=next]');
  await page.click('button[id=next]');

  // Give the query some time to execute
  await sleep(1000);

  // Check that only one gql request happened.
  expect(nbResponses).toBe(1);

  page.removeListener('response', fnRes);

  await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');

  // Fetching the 3rd page still works ok.
  await expect_1_gql(page, 'button[id=next]');
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford'
  );
});
