import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expect_0_gql,
  expect_to_be,
  expectToContain,
  goto
} from '../../../../lib/utils/testsHelper.js';

test.describe('backwards cursor paginatedQuery', () => {
  test('loadPreviousPage', async ({ page }) => {
    await goto(page, routes.Pagination_query_backwards_cursor);

    await expect_to_be(page, 'Eddie Murphy, Clint Eastwood');

    // wait for the api response
    await expect_1_gql(page, 'button[id=previous]');

    // make sure we got the new content
    await expect_to_be(page, 'Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood');
  });

  test('refetch', async ({ page }) => {
    await goto(page, routes.Pagination_query_backwards_cursor);

    // wait for the api response
    await expect_1_gql(page, 'button[id=previous]');

    // wait for the api response
    const response = await expect_1_gql(page, 'button[id=refetch]');
    expect(response).toBe(
      '{"data":{"usersConnection":{"edges":[{"node":{"name":"Will Smith","id":"pagination-query-backwards-cursor:5","__typename":"User"},"cursor":"YXJyYXljb25uZWN0aW9uOjQ="},{"node":{"name":"Harrison Ford","id":"pagination-query-backwards-cursor:6","__typename":"User"},"cursor":"YXJyYXljb25uZWN0aW9uOjU="},{"node":{"name":"Eddie Murphy","id":"pagination-query-backwards-cursor:7","__typename":"User"},"cursor":"YXJyYXljb25uZWN0aW9uOjY="},{"node":{"name":"Clint Eastwood","id":"pagination-query-backwards-cursor:8","__typename":"User"},"cursor":"YXJyYXljb25uZWN0aW9uOjc="}],"pageInfo":{"endCursor":"YXJyYXljb25uZWN0aW9uOjc=","hasNextPage":false,"hasPreviousPage":true,"startCursor":"YXJyYXljb25uZWN0aW9uOjQ="}}}}'
    );
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
      await expect_to_be(page, data[i]);
    }

    // make sure we have all of the data loaded
    await expect_to_be(page, data[2]);

    await expectToContain(page, `"hasPreviousPage":false`);

    await expect_0_gql(page, 'button[id=previous]');
  });
});
