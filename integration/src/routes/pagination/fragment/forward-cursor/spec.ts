import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLResponse,
  expectToBe,
  expectToContain,
  goto
} from '../../../../lib/utils/testsHelper.js';

test.describe('forwards cursor paginatedFragment', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Pagination_fragment_forward_cursor);

    await expectToBe(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=next]');

    // make sure we got the new content
    await expectToBe(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
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
      // wait for the request to resolve
      await expectGraphQLResponse(page, 'button[id=next]');

      // check the page info
      await expectToBe(page, data[i]);
    }

    // make sure we have all of the data loaded
    await expectToBe(page, data[2]);

    await expectToContain(page, `"hasNextPage":false`);

    await expectNoGraphQLResponse(page, 'button[id=next]');
  });
});
