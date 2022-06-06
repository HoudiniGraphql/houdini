import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';

test.describe('forwards cursor paginatedQuery', () => {
  test('loadNextPage', async ({ page }) => {
    await page.goto(routes.Pagination_fragment_forward_cursor);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=next]');

    // // make sure we got the new content
    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('refetch', async ({ page }) => {
    await page.goto(routes.Pagination_fragment_forward_cursor);

    await expectNoGraphQLRequest(page);

    // wait for the api response
    let response = await expectGraphQLResponse(page, 'button[id=next]');
    expect(response).not.toContain(
      '"name":"Bruce Willis","id":"pagination-query-forwards-cursor:1"'
    );
    expect(response).not.toContain(
      '"name":"Samuel Jackson","id":"pagination-query-forwards-cursor:2"'
    );
    expect(response).toContain('"name":"Morgan Freeman","id":"pagination-query-forwards-cursor:3"');
    expect(response).toContain('"name":"Tom Hanks","id":"pagination-query-forwards-cursor:4"');

    // wait for the api response
    response = await expectGraphQLResponse(page, 'button[id=refetch]');

    expect(response).toContain('"name":"Bruce Willis","id":"pagination-query-forwards-cursor:1"');
    expect(response).toContain('"name":"Samuel Jackson","id":"pagination-query-forwards-cursor:2"');
    expect(response).toContain('"name":"Morgan Freeman","id":"pagination-query-forwards-cursor:3"');
    expect(response).toContain('"name":"Tom Hanks","id":"pagination-query-forwards-cursor:4"');
  });

  test('refetch with input "first" having a default value', function () {
    test.skip();
  });

  test('page info tracks connection state', async ({ page }) => {
    await page.goto(routes.Pagination_fragment_forward_cursor);

    const data = [
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks',
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford',
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
    ];

    // load the next 3 pages
    for (let i = 0; i < 3; i++) {
      // wait for the request to resolve
      await expectGraphQLResponse(page, 'button[id=next]');

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
