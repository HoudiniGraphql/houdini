import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectNGraphQLResponse } from '../../lib/utils/testsHelper.js';

test.describe('NETWORK Page', () => {
  test('no data from SSR, yes data from CSR', async ({ page }) => {
    const body = await page.goto(routes.Stores_Network);
    const text = await body?.text();
    expect(text).toContain('<ul></ul>');

    await page.goto(routes.Stores_Network);

    const listStr = await expectNGraphQLResponse(page, null, 2);
    const expected = [
      `{"data":{"hello":"Hello World! // From Houdini!"}}`,
      `{"data":{"usersList":[{"id":"store-user-query:1","name":"Bruce Willis","birthDate":-466732800000},{"id":"store-user-query:2","name":"Samuel Jackson","birthDate":-663638400000},{"id":"store-user-query:3","name":"Morgan Freeman","birthDate":-1028419200000},{"id":"store-user-query:4","name":"Tom Hanks","birthDate":-425433600000}]}}`
    ];
    expect(listStr).toStrictEqual(expected);
  });
});
