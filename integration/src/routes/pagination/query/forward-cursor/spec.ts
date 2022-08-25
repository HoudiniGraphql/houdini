import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expect_0_gql,
  expectToBe,
  expectToContain,
  goto
} from '../../../../lib/utils/testsHelper.js';

test.describe('forwards cursor paginatedQuery', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Pagination_query_forward_cursor);

    await expectToBe(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expect_1_gql(page, 'button[id=next]');

    // // make sure we got the new content
    await expectToBe(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('refetch', async ({ page }) => {
    await goto(page, routes.Pagination_query_forward_cursor);

    // wait for the api response
    let response = await expect_1_gql(page, 'button[id=next]');
    expect(response).not.toContain(
      '"name":"Bruce Willis","id":"pagination-query-forwards-cursor:1"'
    );
    expect(response).not.toContain(
      '"name":"Samuel Jackson","id":"pagination-query-forwards-cursor:2"'
    );
    expect(response).toContain('"name":"Morgan Freeman","id":"pagination-query-forwards-cursor:3"');
    expect(response).toContain('"name":"Tom Hanks","id":"pagination-query-forwards-cursor:4"');

    // wait for the api response
    response = await expect_1_gql(page, 'button[id=refetch]');

    expect(response).toContain('"name":"Bruce Willis","id":"pagination-query-forwards-cursor:1"');
    expect(response).toContain('"name":"Samuel Jackson","id":"pagination-query-forwards-cursor:2"');
    expect(response).toContain('"name":"Morgan Freeman","id":"pagination-query-forwards-cursor:3"');
    expect(response).toContain('"name":"Tom Hanks","id":"pagination-query-forwards-cursor:4"');
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
      await expectToBe(page, data[i]);
    }

    // make sure we have all of the data loaded
    await expectToBe(page, data[2]);

    await expectToContain(page, `"hasNextPage":false`);

    await expect_0_gql(page, 'button[id=next]');
  });
});
