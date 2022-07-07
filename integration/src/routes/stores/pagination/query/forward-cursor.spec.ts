import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe,
  expectToContain
} from '../../../../lib/utils/testsHelper.js';

test.describe('forwards cursor paginatedQuery', () => {
  test('loadNextPage', async ({ page }) => {
    await page.goto(routes.Pagination_query_forward_cursor);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=next]');

    // // make sure we got the new content
    await expectToBe(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('refetch', async ({ page }) => {
    await page.goto(routes.Pagination_query_forward_cursor);

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

  test('page info tracks connection state', async ({ page }) => {
    await page.goto(routes.Pagination_query_forward_cursor);

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
      await expectGraphQLResponse(page, 'button[id=next]');

      // check the data
      await expectToBe(page, data[i]);
    }

    // make sure we have all of the data loaded
    await expectToBe(page, data[2]);

    await expectToContain(page, `"hasNextPage":false`);

    await expectNoGraphQLRequest(page, 'button[id=next]');
  });
});
