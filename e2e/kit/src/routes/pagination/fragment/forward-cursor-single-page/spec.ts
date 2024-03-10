import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expect_0_gql,
  expect_to_be,
  expectToContain,
  goto
} from '../../../../lib/utils/testsHelper.js';

test.describe('forwards cursor paginatedFragment in SinglePage mode', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Pagination_fragment_forward_cursor_single_page);

    await expect_to_be(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expect_1_gql(page, 'button[id=next]');

    // make sure we got the new content
    await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('page info tracks connection state', async ({ page }) => {
    await goto(page, routes.Pagination_fragment_forward_cursor_single_page);

    const data = [
      'Morgan Freeman, Tom Hanks',
      'Will Smith, Harrison Ford',
      'Eddie Murphy, Clint Eastwood'
    ];

    // load the next 3 pages
    for (let i = 0; i < 3; i++) {
      // wait for the request to resolve
      await expect_1_gql(page, 'button[id=next]');

      // check the page info
      await expect_to_be(page, data[i]);
    }

    // make sure we have all of the data loaded
    await expect_to_be(page, data[2]);

    await expectToContain(page, `"hasNextPage":false`);

    await expect_0_gql(page, 'button[id=next]');
  });
});
