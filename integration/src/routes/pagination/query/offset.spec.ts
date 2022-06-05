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

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=next]');

    // make sure we got the new content
    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('offset refetch', async ({ page }) => {
    await page.goto(routes.Pagination_query_offset);

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=next]');

    // wait for the api response
    const response = await expectGraphQLResponse(page, 'button[id=refetch]');

    expect(response).toBe('xxx');
  });
});
