import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';

test.describe('backwards cursor paginatedFragment', () => {
  test('loadPreviousPage', async ({ page }) => {
    await page.goto(routes.Pagination_fragment_backwards_cursor);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Clint Eastwood, Eddie Murphy Jackson');

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=previous]');

    // make sure we got the new content
    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Clint Eastwood, Eddie Murphy Jackson, Harrison Ford, Will Smith');
  });

  test('refetch', async ({ page }) => {
    await page.goto(routes.Pagination_fragment_backwards_cursor);

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=previous]');

    // wait for the api response
    const response = await expectGraphQLResponse(page, 'button[id=refetch]');

    expect(response).toBe('xxx');
  });

  test('page info tracks connection state', async ({ page }) => {
    await page.goto(routes.Pagination_fragment_backwards_cursor);

    // load the previous 4 pages
    for (let i = 0; i < 4; i++) {
      // wait for the request to resolve
      await expectGraphQLResponse(page, 'button[id=previous]');
      // check the page info
      const content = await page.locator('div[id=result]').textContent();
      expect(content).toBe('xxx');
    }

    // make sure we have all of the data loaded
    const content = await page.locator('div[id=result]').textContent();
    expect(content).toBe('xxx');
  });
});
