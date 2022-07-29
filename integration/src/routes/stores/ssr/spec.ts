import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  clientSideNavigation,
  expectNGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe,
  navSelector
} from '../../lib/utils/testsHelper.js';

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
    const body = await page.goto(routes.Stores_SSR);

    const text = await body?.text();

    const data = [
      'store-user-query:1 - Bruce Willis',
      'store-user-query:2 - Samuel Jackson',
      'store-user-query:3 - Morgan Freeman',
      'store-user-query:4 - Tom Hanks'
    ];

    for (const entry of data) {
      expect(text).toContain(`<li>${entry}`);
    }
    expect(text?.match(/<li>/g)).toHaveLength(4);
  });

  test('From SSR to another page containing the same query should use the cache', async ({
    page
  }) => {
    await page.goto(routes.Stores_SSR);

    await clientSideNavigation(page, routes.Stores_Network);
    await expectNoGraphQLRequest(page);
  });

  test('From HOME, navigate to page (only 2 graphql queries should happen, not more!)', async ({
    page
  }) => {
    await page.goto(routes.Home);

    const listStr = await expectNGraphQLResponse(page, navSelector(routes.Stores_SSR), 2);
    const expected = [
      `{"data":{"hello":"Hello World! // From Houdini!"}}`,
      `{"data":{"usersList":[{"id":"store-user-query:1","name":"Bruce Willis","birthDate":-466732800000},{"id":"store-user-query:2","name":"Samuel Jackson","birthDate":-663638400000},{"id":"store-user-query:3","name":"Morgan Freeman","birthDate":-1028419200000},{"id":"store-user-query:4","name":"Tom Hanks","birthDate":-425433600000}]}}`
    ];
    expect(listStr).toStrictEqual(expected);
  });
});
