import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, goto_expect_n_gql } from '../../../lib/utils/testsHelper.js';

test.describe('Metadata Page', () => {
  test('Mutation => Should display the raw result in the console as info', async ({ page }) => {
    // Go on the page
    await goto_expect_n_gql(page, routes.Stores_Metadata, 1);

    // Listen to the console
    let displayed = '';
    page.on('console', (msg) => {
      if (msg.type() === 'info') displayed = msg.text();
    });

    //Click the button
    // Mutate the data (that will be displayed in the list)
    await expect_1_gql(page, 'button[id=mutate]');

    expect(displayed).toBe(
      `{"data":{"updateUser":{"id":"list-store-user-subunsub:5","name":"Hello!"}}}`
    );
  });
});
