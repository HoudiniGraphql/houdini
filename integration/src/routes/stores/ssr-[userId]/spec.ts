import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe,
  navSelector
} from '../../lib/utils/testsHelper.js';

// test.beforeEach(async ({ page }) => {
//   page.on('request', (request) => {
//     console.log('>>', request.method(), request.url());
//   });
//   page.on('response', (response) => {
//     console.log('<<', response.status(), response.url());
//   });

//   await page.goto(routes.Stores_SSR);
// });

test.describe('SSR-[userId] Page', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_SSR_UserId_2);

    await expectNoGraphQLRequest(page);
  });

  test('Right Data in <h1> elements (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_SSR_UserId_2);

    await expectToBe(page, 'SSR - [userId: 2]', 'h1');
    await expectToBe(page, 'store-user-query:2 - Samuel Jackson');
  });

  test('From HOME, navigate to page (a graphql query must happen)', async ({ page }) => {
    await page.goto(routes.Home);

    const response = await expectGraphQLResponse(page, navSelector(routes.Stores_SSR_UserId_2));
    expect(response).toBe('{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}}}');
  });

  test('Check refresh', async ({ page }) => {
    await page.goto(routes.Stores_SSR_UserId_2);

    await expectToBe(page, 'store-user-query:2 - Samuel Jackson');

    // 1 Check another data (id = 1)
    let response = await expectGraphQLResponse(page, 'button[id="refresh-1"]');
    expect(response).toBe('{"data":{"user":{"id":"store-user-query:1","name":"Bruce Willis"}}}');
    await expectToBe(page, 'store-user-query:1 - Bruce Willis');

    // 2 go back to (id = 2) with default policy (CacheOrNetwork) => No request should happen and Data should be updated
    await expectNoGraphQLRequest(page, `button[id="refresh-2"]`);
    await expectToBe(page, 'store-user-query:2 - Samuel Jackson');

    // 3 Refresh without variables (so should take the last one, here 2) with policy NetworkOnly to have a graphql request
    response = await expectGraphQLResponse(page, `button[id="refresh-null"]`);
    expect(response).toBe('{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}}}');
    await expectToBe(page, 'store-user-query:2 - Samuel Jackson');

    // 4 Check id 77 (that doens't exist)
    response = await expectGraphQLResponse(page, `button[id="refresh-77"]`);
    expect(response).toBe(
      '{"data":null,"errors":[{"message":"User not found","locations":[{"line":2,"column":3}],"path":["user"],"extensions":{"code":404}}]}'
    );
  });

  test('Check that variables order doesnt matter', async ({ page }) => {
    await page.goto(routes.Stores_SSR_UserId_2);

    await expectNoGraphQLRequest(page, 'button[id="refresh-2"]');

    // Switch the order of variables, should not retrigger
    await expectNoGraphQLRequest(page, `button[id="refresh-2Star"]`);
  });
});
