import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';

test.describe('backwards cursor paginatedQuery', () => {
  test('loadPreviousPage', async ({ page }) => {
    await page.goto(routes.Pagination_query_backwards_cursor);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Eddie Murphy, Clint Eastwood');

    // load the next page
    await page.locator('button[id=previous]').click();

    // wait for the api response
    await expectGraphQLResponse(page);

    // make sure we got the new content
    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood');
  });

  test('refetch', async ({ page }) => {
    await page.goto(routes.Pagination_query_forward_cursor);

    // load the next page
    page.locator('button[id=previous]').click();

    // wait for the api response
    await expectGraphQLResponse(page);

    // click on the refetch button
    page.locator('button[id=refetch]').click();

    // wait for the api response
    const response = await expectGraphQLResponse(page);

    // TODO JYC & Alec:
    // 1/ refetch is not working as expected I think because no network query are happening taking from the cache?!
    // 2/ in store mode, we loose track of variables I think.
    expect(response).toBe('xxx');
  });

  test('page info tracks connection state', async ({ page }) => {
    await page.goto(routes.Pagination_query_backwards_cursor);

    const data = [
      'Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood',
      'Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood',
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
    ];

    // load the previous 3 pages
    for (let i = 0; i < 3; i++) {
      // click the button
      await page.locator('button[id=previous]').click();
      // wait for the request to resolve
      await expectGraphQLResponse(page);
      // check the page info
      const content = await page.locator('div[id=result]').textContent();
      expect(content).toBe(data[i]);
    }

    // make sure we have all of the data loaded
    const content = await page.locator('div[id=result]').textContent();
    expect(content).toBe(data[2]);

    const contentInfo = await page.locator('div[id=pageInfo]').textContent();
    expect(contentInfo).toContain(`\"hasPreviousPage\":false`);

    await page.locator('button[id=previous]').click();
    await expectNoGraphQLRequest(page);
  });
});
