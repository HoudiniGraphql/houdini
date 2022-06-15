import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  clientSideNavigation,
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

test.describe('SSR Page', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_SSR);

    await expectNoGraphQLRequest(page);
  });

  test('expect the hello result (from another *.graphql file)', async ({ page }) => {
    await page.goto(routes.Stores_SSR);

    await expectToBe(page, 'Hello World! // From Houdini!');
  });

  test('Right Data in <li> elements (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_SSR);

    const data = [
      'store-user-query:1 - Bruce Willis',
      'store-user-query:2 - Samuel Jackson',
      'store-user-query:3 - Morgan Freeman',
      'store-user-query:4 - Tom Hanks'
    ];

    const li = page.locator('li');
    const count = await li.count();
    expect(count, 'number of <li> elements').toBe(data.length);

    for (let i = 0; i < count; ++i) {
      const text = await li.nth(i).textContent();
      expect(text?.trim(), 'Content of <li> element').toBe(data[i]);
    }
  });

  test('From SSR to another page containing the same query should use the cache', async ({
    page
  }) => {
    await page.goto(routes.Stores_SSR);

    clientSideNavigation(page, routes.Stores_Network);
    await expectNoGraphQLRequest(page);
  });

  test('From HOME, navigate to page (a graphql query must happen)', async ({ page }) => {
    await page.goto(routes.Home);

    const response = await expectGraphQLResponse(page, navSelector(routes.Stores_SSR));
    expect(response).toBe(
      '{"data":{"usersList":[{"id":"store-user-query:1","name":"Bruce Willis","birthDate":-466732800000},{"id":"store-user-query:2","name":"Samuel Jackson","birthDate":-663638400000},{"id":"store-user-query:3","name":"Morgan Freeman","birthDate":-1028419200000},{"id":"store-user-query:4","name":"Tom Hanks","birthDate":-425433600000}]}}'
    );
  });
});
