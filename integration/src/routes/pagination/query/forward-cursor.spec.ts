import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';

test.describe('forwards cursor paginatedQuery', () => {
  test('loadNextPage', async ({ page }) => {
    await page.goto(routes.Pagination_query_forward_cursor);

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

  test('refetch', async ({ page }) => {
    await page.goto(routes.Pagination_query_forward_cursor);

    // load the next page
    page.locator('button[id=next]').click();

    // wait for the api response
    await expectGraphQLResponse(page);

    // click on the refetch button
    page.locator('button[id=refetch]').click();

    // wait for the api response
    const response = await expectGraphQLResponse(page);

    // make sure the refetch contained information for the full list
    expect(response).toContain('"name":"Bruce Willis","id":"1"');
    expect(response).toContain('"name":"Samuel Jackson","id":"2"');
    expect(response).toContain('"name":"Morgan Freeman","id":"3"');
    expect(response).toContain('"name":"Tom Hanks","id":"4"');
  });

  test('page info tracks connection state', async ({ page }) => {
    await page.goto(routes.Pagination_query_forward_cursor);

    const data = [
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks',
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford',
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
    ];

    // load the next 3 pages
    for (let i = 0; i < 3; i++) {
      // click the button
      await page.locator('button[id=next]').click();
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
    expect(contentInfo).toContain(`\"hasNextPage\":false`);

    await page.locator('button[id=next]').click();
    await expectNoGraphQLRequest(page);
  });
});
