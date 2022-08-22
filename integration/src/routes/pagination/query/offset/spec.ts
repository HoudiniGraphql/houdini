import { routes } from '../../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe,
  goto
} from '../../../../lib/utils/testsHelper.js';
import { expect, test } from '@playwright/test';

test.describe('offset paginatedQuery', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Pagination_query_offset);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=next]');

    // make sure we got the new content
    await expectToBe(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('refetch', async ({ page }) => {
    await goto(page, routes.Pagination_query_offset);

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=next]');

    // wait for the api response
    const response = await expectGraphQLResponse(page, 'button[id=refetch]');
    expect(response).toBe(
      '{"data":{"usersList":[{"name":"Bruce Willis","id":"pagination-query-offset:1"},{"name":"Samuel Jackson","id":"pagination-query-offset:2"},{"name":"Morgan Freeman","id":"pagination-query-offset:3"},{"name":"Tom Hanks","id":"pagination-query-offset:4"}]}}'
    );
  });
});
