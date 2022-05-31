import { routes } from '$lib/utils/routes.js';
import {
  clientSideNavigation,
  expectGraphQLResponse,
  expectNoGraphQLRequest
} from '$lib/utils/testsHelper.js';
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

test.describe('SSR Page', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_SSR);

    await expectNoGraphQLRequest(page);
  });

  test('Right Data in <li> elements (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_SSR);

    const li = page.locator('li');
    const count = await li.count();
    expect(count, 'number of <li> elements').toBe(2);

    const data = ['1 - Bruce Willis', '2 - Samuel Jackson'];
    for (let i = 0; i < count; ++i) {
      const text = await li.nth(i).textContent();
      expect(text?.trim(), 'Content of <li> element').toBe(data[i]);
    }
  });

  test('From SSR to another page containing the same query should use the cache', async ({
    page
  }) => {
    await page.goto(routes.Stores_SSR);

    await clientSideNavigation(page, routes.Stores_Network);
    await expectNoGraphQLRequest(page);
  });

  test('From HOME, navigate to SSR page (a graphql query must happen)', async ({ page }) => {
    await page.goto(routes.Home);

    await clientSideNavigation(page, routes.Stores_SSR);

    const str = await expectGraphQLResponse(page);
    expect(str).toBe(
      '{"data":{"usersList":[{"id":"1","name":"Bruce Willis","birthDate":-466732800000},{"id":"2","name":"Samuel Jackson","birthDate":-663638400000}]}}'
    );
  });
});
