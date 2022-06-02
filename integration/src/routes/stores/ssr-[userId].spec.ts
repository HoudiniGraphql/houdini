import { routes } from '../../lib/utils/routes.ts';
import {
  clientSideNavigation,
  expectGraphQLResponse,
  expectNoGraphQLRequest
} from '../../lib/utils/testsHelper.ts';
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
    expect(textResult, 'Content of <p> element').toBe('2 - Samuel Jackson');
  });

  test('From HOME, navigate to page (a graphql query must happen)', async ({ page }) => {
    await page.goto(routes.Home);

    await clientSideNavigation(page, routes.Stores_SSR_UserId_2);

    const str = await expectGraphQLResponse(page);
    expect(str).toBe('{"data":{"user":{"id":"2","name":"Samuel Jackson"}}}');
  });

  test('Check refresh', async ({ page }) => {
    await page.goto(routes.Stores_SSR_UserId_2);

    let textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('2 - Samuel Jackson');

    const buttonRefreshNull = page.locator(`button[id="refresh-null"]`);
    const buttonRefresh1 = page.locator(`button[id="refresh-1"]`);
    const buttonRefresh2 = page.locator(`button[id="refresh-2"]`);
    const buttonRefresh77 = page.locator(`button[id="refresh-77"]`);

    // 1 Check another data (id = 1)
    buttonRefresh1.click();
    let str = await expectGraphQLResponse(page);
    expect(str).toBe('{"data":{"user":{"id":"1","name":"Bruce Willis"}}}');
    textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('1 - Bruce Willis');

    // 2 go back to (id = 2) with default policy (CacheOrNetwork) => No request should happen and Data should be updated
    buttonRefresh2.click();
    await expectNoGraphQLRequest(page);
    textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('2 - Samuel Jackson');

    // 3 Refresh without variables (so should take the last one, here 2) with policy NetworkOnly to have a graphql request
    buttonRefreshNull.click();
    str = await expectGraphQLResponse(page);
    expect(str).toBe('{"data":{"user":{"id":"2","name":"Samuel Jackson"}}}');
    textResult = await page.locator('p').textContent();
    expect(textResult, 'Content of <p> element').toBe('2 - Samuel Jackson');

    // 4 Check id 77 (that doens't exist)
    buttonRefresh77.click();
    str = await expectGraphQLResponse(page);
    expect(str).toBe(
      '{"data":null,"errors":[{"message":"User not found","locations":[{"line":2,"column":3}],"path":["user"],"extensions":{"code":404}}]}'
    );
  });
});
