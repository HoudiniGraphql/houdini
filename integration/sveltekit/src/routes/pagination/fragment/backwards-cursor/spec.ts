import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import {
  expect_1_gql,
  expect_0_gql,
  expectToBe,
  expectToContain,
  goto
} from '../../../../lib/utils/testsHelper';

test.describe('backwards cursor paginatedFragment', () => {
  test('loadPreviousPage', async ({ page }) => {
    await goto(page, routes.Pagination_fragment_backwards_cursor);

    await expectToBe(page, 'Eddie Murphy, Clint Eastwood');

    // wait for the api response
    await expect_1_gql(page, 'button[id=previous]');

    // make sure we got the new content
    await expectToBe(page, 'Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood');
  });

  test('page info tracks connection state', async ({ page }) => {
    await goto(page, routes.Pagination_query_backwards_cursor);

    const data = [
      'Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood',
      'Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood',
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
    ];

    // load the previous 3 pages
    for (let i = 0; i < 3; i++) {
      // wait for the request to resolve
      await expect_1_gql(page, 'button[id=previous]');
      // check the page info
      await expectToBe(page, data[i]);
    }

    // make sure we have all of the data loaded
    await expectToBe(page, data[2]);

    await expectToContain(page, `"hasPreviousPage":false`);

    await expect_0_gql(page, 'button[id=previous]');
  });
});
