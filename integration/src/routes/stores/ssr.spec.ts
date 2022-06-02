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

test.describe('SSR Page', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_SSR);

    await expectNoGraphQLRequest(page);
  });

  test('Right Data in <li> elements (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_SSR);

    const li = page.locator('li');
    const count = await li.count();
    expect(count, 'number of <li> elements').toBe(8);

    const data = [
      '1 - Bruce Willis',
      '2 - Samuel Jackson',
      '3 - Morgan Freeman',
      '4 - Tom Hanks',
      '5 - Will Smith',
      '6 - Harrison Ford',
      '7 - Eddie Murphy',
      '8 - Clint Eastwood'
    ];

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

  test('From HOME, navigate to page (a graphql query must happen)', async ({ page }) => {
    await page.goto(routes.Home);

    await clientSideNavigation(page, routes.Stores_SSR);

    const str = await expectGraphQLResponse(page);
    expect(str).toBe(
      '{"data":{"usersList":[{"id":"1","name":"Bruce Willis","birthDate":-466732800000},{"id":"2","name":"Samuel Jackson","birthDate":-663638400000},{"id":"3","name":"Morgan Freeman","birthDate":-1028419200000},{"id":"4","name":"Tom Hanks","birthDate":-425433600000},{"id":"5","name":"Will Smith","birthDate":-40003200000},{"id":"6","name":"Harrison Ford","birthDate":-866937600000},{"id":"7","name":"Eddie Murphy","birthDate":-276048000000},{"id":"8","name":"Clint Eastwood","birthDate":-1246665600000}]}}'
    );
  });
});
