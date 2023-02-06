import { routes } from '../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expect_0_gql,
  expect_to_be,
  goto,
  navSelector
} from '../../../lib/utils/testsHelper.js';
import { expect, test } from '@playwright/test';

// test.beforeEach(async ({ page }) => {
//   page.on('request', (request) => {
//     console.log('>>', request.method(), request.url());
//   });
//   page.on('response', (response) => {
//     console.log('<<', response.status(), response.url());
//   });

//   await goto(page, routes.Stores_SSR);
// });

test.describe('SSR-[userId] Page', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await goto(page, routes.Stores_SSR_UserId_2);
  });

  test('Right Data in <h1> elements (SSR)', async ({ page }) => {
    await goto(page, routes.Stores_SSR_UserId_2);

    await expect_to_be(page, 'SSR - [userId: 2]', 'h1');
    await expect_to_be(page, 'store-user-query:2 - Samuel Jackson');
  });

  test('From HOME, navigate to page (a graphql query must happen)', async ({ page }) => {
    await goto(page, routes.Home);

    const response = await expect_1_gql(page, navSelector(routes.Stores_SSR_UserId_2));
    expect(response).toBe('{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}}}');
  });

  test('Check refresh', async ({ page }) => {
    await goto(page, routes.Stores_SSR_UserId_2);

    await expect_to_be(page, 'store-user-query:2 - Samuel Jackson');

    // 1 Check another data (id = 1)
    let response = await expect_1_gql(page, 'button[id="refresh-1"]');
    expect(response).toBe('{"data":{"user":{"id":"store-user-query:1","name":"Bruce Willis"}}}');
    await expect_to_be(page, 'store-user-query:1 - Bruce Willis');

    // 2 go back to (id = 2) with default policy (CacheOrNetwork) => No request should happen and Data should be updated
    await expect_0_gql(page, `button[id="refresh-2"]`);
    await expect_to_be(page, 'store-user-query:2 - Samuel Jackson');

    // 3 Refresh without variables (so should take the last one, here 2) with policy NetworkOnly to have a graphql request
    response = await expect_1_gql(page, `button[id="refresh-null"]`);
    expect(response).toBe('{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}}}');
    await expect_to_be(page, 'store-user-query:2 - Samuel Jackson');

    // 4 Check id 77 (that doens't exist)
    response = await expect_1_gql(page, `button[id="refresh-77"]`);
    expect(response).toBe(
      '{"data":null,"errors":[{"message":"User not found","locations":[{"line":2,"column":3}],"path":["user"]}]}'
    );
  });

  test('Check that variables order doesnt matter', async ({ page }) => {
    await goto(page, routes.Stores_SSR_UserId_2);

    await expect_0_gql(page, 'button[id="refresh-2"]');

    // Switch the order of variables, should not retrigger
    await expect_0_gql(page, `button[id="refresh-2Star"]`);
  });
});
