import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, goto_expect_n_gql, waitForConsole } from '../../../lib/utils/testsHelper.js';

test.describe('Partial Pages', () => {
  test("overlapping nested routes shouldn't trigger", async ({ page }) => {
    // Listen to the console
    let displayed = '';
    page.on('console', (msg) => {
      if (msg.type() === 'info') {
        displayed = msg.text();
      }
    });

    // Go on the page
    await goto_expect_n_gql(page, routes.Stores_Partial_Off, 0);

    // we shouldn't start with a partial result
    expect(displayed).toBe('false');

    //Click the button
    // Mutate the data (that will be displayed in the console)
    await expect_1_gql(page, 'button[id=mutate]');

    expect(displayed).toBe(
      '{"fetching":false,"variables":{"id":"5","name":"Hello!"},"data":{"updateUser":{"id":"list-store-user-subunsub:5","name":"Hello!"}},"errors":null,"partial":false,"stale":false,"source":"network"}'
    );
  });
});
