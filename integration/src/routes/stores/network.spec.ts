import { routes } from '../../lib/utils/routes.ts';
import { expectGraphQLResponse } from '../../lib/utils/testsHelper.ts';
import { expect, test } from '@playwright/test';

test.describe('NETWORK Page', () => {
  test('we have no li element(s) in <ul></ul> (no data from SSR)', async ({ page, browser }) => {
    const testData = ''; // To replace real data coming from the network
    await page.route('**/graphql', (route) =>
      route.fulfill({
        status: 200,
        body: testData
      })
    );
    await page.goto(routes.Stores_Network);

    const ele = await page.content();
    expect(ele).toContain('<ul></ul>');
  });

  test('Getting the right data in a network mode (CSR)', async ({ page }) => {
    await page.goto(routes.Stores_Network);

    const str = await expectGraphQLResponse(page);
    expect(str).toBe(
      '{"data":{"usersList":[{"id":"1","name":"Bruce Willis","birthDate":-466732800000},{"id":"2","name":"Samuel Jackson","birthDate":-663638400000},{"id":"3","name":"Morgan Freeman","birthDate":-1028419200000},{"id":"4","name":"Tom Hanks","birthDate":-425433600000},{"id":"5","name":"Will Smith","birthDate":-40003200000},{"id":"6","name":"Harrison Ford","birthDate":-866937600000},{"id":"7","name":"Eddie Murphy","birthDate":-276048000000},{"id":"8","name":"Clint Eastwood","birthDate":-1246665600000}]}}'
    );
  });
});
