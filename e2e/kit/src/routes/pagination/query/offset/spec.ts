import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_1_gql, expect_to_be, goto, stringify } from '../../../../lib/utils/testsHelper.js';

test.describe('offset paginatedQuery', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Pagination_query_offset);

    await expect_to_be(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expect_1_gql(page, 'button[id=next]');

    // make sure we got the new content
    await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('refetch', async ({ page }) => {
    await goto(page, routes.Pagination_query_offset);

    // wait for the api response
    await expect_1_gql(page, 'button[id=next]');

    // wait for the api response
    const response = await expect_1_gql(page, 'button[id=refetch]');
    expect(response).toBe(
      stringify({"data":{"usersList":[
        {"__typename":"User","id":"pagination-query-offset:1","name":"Bruce Willis"},
        {"__typename":"User","id":"pagination-query-offset:2","name":"Samuel Jackson"},
        {"__typename":"User","id":"pagination-query-offset:3","name":"Morgan Freeman"},
        {"__typename":"User","id":"pagination-query-offset:4","name":"Tom Hanks"}
      ]}})
    );
  });
});
