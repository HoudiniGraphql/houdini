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

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=previous]');

    // make sure we got the new content
    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood');
  });

  test('refetch', async ({ page }) => {
    await page.goto(routes.Pagination_query_backwards_cursor);

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=previous]');

    // wait for the api response
    const response = await expectGraphQLResponse(page, 'button[id=refetch]');

    expect(response).toBe(
      '{"data":{"usersConnection":{"edges":[{"node":{"name":"Will Smith","id":"pagination-query-backwards-cursor:5","__typename":"User"},"cursor":"YXJyYXljb25uZWN0aW9uOjQ="},{"node":{"name":"Harrison Ford","id":"pagination-query-backwards-cursor:6","__typename":"User"},"cursor":"YXJyYXljb25uZWN0aW9uOjU="},{"node":{"name":"Eddie Murphy","id":"pagination-query-backwards-cursor:7","__typename":"User"},"cursor":"YXJyYXljb25uZWN0aW9uOjY="},{"node":{"name":"Clint Eastwood","id":"pagination-query-backwards-cursor:8","__typename":"User"},"cursor":"YXJyYXljb25uZWN0aW9uOjc="}],"pageInfo":{"endCursor":"YXJyYXljb25uZWN0aW9uOjc=","hasNextPage":false,"hasPreviousPage":true,"startCursor":"YXJyYXljb25uZWN0aW9uOjQ="}}}}'
    );
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
      // wait for the request to resolve
      await expectGraphQLResponse(page, 'button[id=previous]');
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
