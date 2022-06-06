import { routes } from '../../lib/utils/routes.js';
import {
  clientSideNavigation,
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  navSelector
} from '../../lib/utils/testsHelper.js';
import { expect, test } from '@playwright/test';

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

    const textTitle = await page.locator('h1').textContent();
    expect(textTitle, 'Content of <h1> element').toBe('SSR - [userId: 2]');
    const textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('store-user-query:2 - Samuel Jackson');
  });

  test('From HOME, navigate to page (a graphql query must happen)', async ({ page }) => {
    await page.goto(routes.Home);

    const str = await expectGraphQLResponse(page, navSelector(routes.Stores_SSR_UserId_2));
    expect(str).toBe('{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}}}');
  });

  test('Check refresh', async ({ page }) => {
    await page.goto(routes.Stores_SSR_UserId_2);

    let textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('store-user-query:2 - Samuel Jackson');

    // 1 Check another data (id = 1)
    let str = await expectGraphQLResponse(page, 'button[id="refresh-1"]');
    expect(str).toBe('{"data":{"user":{"id":"store-user-query:1","name":"Bruce Willis"}}}');
    textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('store-user-query:1 - Bruce Willis');

    // 2 go back to (id = 2) with default policy (CacheOrNetwork) => No request should happen and Data should be updated
    await page.locator(`button[id="refresh-2"]`).click();
    await expectNoGraphQLRequest(page);
    textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('store-user-query:2 - Samuel Jackson');

    // 3 Refresh without variables (so should take the last one, here 2) with policy NetworkOnly to have a graphql request

    str = await expectGraphQLResponse(page, `button[id="refresh-null"]`);
    expect(str).toBe('{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}}}');
    textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('store-user-query:2 - Samuel Jackson');

    // 4 Check id 77 (that doens't exist)
    str = await expectGraphQLResponse(page, `button[id="refresh-77"]`);
    expect(str).toBe(
      '{"data":null,"errors":[{"message":"User not found","locations":[{"line":2,"column":3}],"path":["user"],"extensions":{"code":404}}]}'
    );
  });

  test('Check that variables order doesnt matter', async ({ page }) => {
    await page.goto(routes.Stores_SSR_UserId_2);

    // Adding { tmp: false } => Should retrigger
    await expectGraphQLResponse(page, 'button[id="refresh-2"]');

    // Switch the order of variables, should not retrigger
    await page.locator(`button[id="refresh-2Star"]`).click();
    await expectNoGraphQLRequest(page);
  });
});
