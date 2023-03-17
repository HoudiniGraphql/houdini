import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import {
  expect_n_gql,
  expect_0_gql,
  expect_to_be,
  goto,
  navSelector
} from '../../../lib/utils/testsHelper.js';

test.describe('SSR Page', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await goto(page, routes.Stores_SSR);
  });

  test('expect the hello result (from another *.graphql file)', async ({ page }) => {
    await goto(page, routes.Stores_SSR);

    await expect_to_be(page, 'Hello World! // From Houdini!');
  });

  test('Right Data in <li> elements (SSR)', async ({ page }) => {
    const body = await goto(page, routes.Stores_SSR);

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
    await goto(page, routes.Stores_SSR);

    await expect_0_gql(page, navSelector(routes.Stores_Network));
  });

  test('From HOME, navigate to page (only 2 graphql queries should happen, not more!)', async ({
    page
  }) => {
    await goto(page, routes.Home);

    const listStr = await expect_n_gql(page, navSelector(routes.Stores_SSR), 2);
    expect([JSON.parse(listStr[0]), JSON.parse(listStr[1])]).toMatchObject([
      { data: { hello: 'Hello World! // From Houdini!' } },
      {
        data: {
          usersList: [
            { id: 'store-user-query:1', name: 'Bruce Willis', birthDate: -466732800000 },
            { id: 'store-user-query:2', name: 'Samuel Jackson', birthDate: -663638400000 },
            { id: 'store-user-query:3', name: 'Morgan Freeman', birthDate: -1028419200000 },
            { id: 'store-user-query:4', name: 'Tom Hanks', birthDate: -425433600000 }
          ]
        }
      }
    ]);
  });
});
