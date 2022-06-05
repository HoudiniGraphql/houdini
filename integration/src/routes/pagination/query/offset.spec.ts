import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';

test.describe('offset paginatedQuery', () => {
  test('loadNextPage', async ({ page }) => {
    await page.goto(routes.Pagination_query_offset);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis, Samuel Jackson');

    // load the next page
    await page.locator('button[id=next]').click();

    // wait for the api response
    await expectGraphQLResponse(page);

    // make sure we got the new content
    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('offset refetch', async ({ page }) => {
    await page.goto(routes.Pagination_query_offset);

    // load the next page
    await page.locator('button[id=next]').click();

    // wait for the api response
    await expectGraphQLResponse(page);

    // click on the refetch button
    await page.locator('button[id=refetch]').click();

    // wait for the api response
    const response = await expectGraphQLResponse(page);

    expect(response).toBe(
      '{"data":{"usersList":[{"name":"Bruce Willis","id":"1"},{"name":"Samuel Jackson","id":"2"},{"name":"Morgan Freeman","id":"3"},{"name":"Tom Hanks","id":"4"}]}}'
    );
  });
});
