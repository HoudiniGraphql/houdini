import { routes } from '../../../lib/utils/routes.js';
import { expectNGraphQLResponse } from '../../../lib/utils/testsHelper.js';
import { expect, test } from '@playwright/test';

test.describe('NETWORK Page', () => {
  test('we have no li element(s) in <ul></ul> (no data from SSR)', async ({ page }) => {
    // Fake GraphQL response, to not load any data.
    // Here just to make sure we have no data in the page from the start.
    // The test was failing because the page was loading data too fast!
    await page.route('**/graphql', (route) =>
      route.fulfill({
        status: 200,
        body: ''
      })
    );

    await page.goto(routes.Stores_Network);

    const ele = await page.content();
    expect(ele).toContain('<ul></ul>');
  });

  test('Getting the right data in a network mode (CSR)', async ({ page }) => {
    await page.goto(routes.Stores_Network);

    const listStr = await expectNGraphQLResponse(page, null, 2);
    const expected = [
      `{"data":{"hello":"Hello World! // From Houdini!"}}`,
      `{"data":{"usersList":[{"id":"store-user-query:1","name":"Bruce Willis","birthDate":-466732800000},{"id":"store-user-query:2","name":"Samuel Jackson","birthDate":-663638400000},{"id":"store-user-query:3","name":"Morgan Freeman","birthDate":-1028419200000},{"id":"store-user-query:4","name":"Tom Hanks","birthDate":-425433600000}]}}`
    ];
    expect(listStr).toStrictEqual(expected);
  });
});
