import { routes } from '../../../lib/utils/routes';
import {
  expectToContain,
  expect_0_gql,
  expect_1_gql,
  expect_to_be,
  goto
} from '../../../lib/utils/testsHelper';
import test from '@playwright/test';

test.describe('Svelte 5 runes forward simple paginated query', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Svelte5_Runes_Pagination);

    await expect_to_be(page, 'Bruce Willis, Samuel Jackson');

    await expect_1_gql(page, 'button[id=next]');

    await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('page info tracks connection state', async ({ page }) => {
    await goto(page, routes.Pagination_query_forward_cursor);

    const data = [
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks',
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford',
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
    ];

    // load the next 3 pages
    for (let i = 0; i < 3; i++) {
      // check the page info to know if we will click on next?
      await expectToContain(page, `"hasNextPage":true`);

      // wait for the request to resolve
      await expect_1_gql(page, 'button[id=next]');

      // check the data
      await expect_to_be(page, data[i]);
    }

    // make sure we have all of the data loaded
    await expect_to_be(page, data[2]);

    await expectToContain(page, `"hasNextPage":false`);

    await expect_0_gql(page, 'button[id=next]');
  });
});
