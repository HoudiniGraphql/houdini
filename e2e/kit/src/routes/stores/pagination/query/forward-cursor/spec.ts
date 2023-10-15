import { routes } from '../../../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expect_0_gql,
  expect_to_be,
  expectToContain,
  goto
} from '../../../../../lib/utils/testsHelper.js';
import { expect, test } from '@playwright/test';

test.describe('forwards cursor paginatedQuery', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Pagination_query_forward_cursor);

    await expect_to_be(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expect_1_gql(page, 'button[id=next]');

    // // make sure we got the new content
    await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('refetch', async ({ page }) => {
    await goto(page, routes.Pagination_query_forward_cursor);

    // wait for the api response
    let response = await expect_1_gql(page, 'button[id=next]');
    expect(response).not.toContain(
      '"id":"pagination-query-forwards-cursor:1","name":"Bruce Willis"'
    );
    expect(response).not.toContain(
      '"id":"pagination-query-forwards-cursor:2","name":"Samuel Jackson"'
    );
    expect(response).toContain('"id":"pagination-query-forwards-cursor:3","name":"Morgan Freeman"');
    expect(response).toContain('"id":"pagination-query-forwards-cursor:4","name":"Tom Hanks"');

    // wait for the api response
    response = await expect_1_gql(page, 'button[id=refetch]');

    expect(response).toContain('"id":"pagination-query-forwards-cursor:1","name":"Bruce Willis"');
    expect(response).toContain('"id":"pagination-query-forwards-cursor:2","name":"Samuel Jackson"');
    expect(response).toContain('"id":"pagination-query-forwards-cursor:3","name":"Morgan Freeman"');
    expect(response).toContain('"id":"pagination-query-forwards-cursor:4","name":"Tom Hanks"');
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

      // make sure that page info is an object
      const pageInfo = (await page.textContent('div[id=pageInfo]')) || 'null';
      expect(Array.isArray(JSON.parse(pageInfo))).toBeFalsy();

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
