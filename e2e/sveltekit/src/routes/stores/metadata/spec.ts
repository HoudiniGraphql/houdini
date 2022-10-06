import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes';
import { expect_1_gql, goto_expect_n_gql } from '../../../lib/utils/testsHelper';

test.describe('Metadata Page', () => {
  test('Mutation => Should display the raw result in the console as info', async ({ page }) => {
    // Listen to the console
    let displayed = '';
    page.on('console', (msg) => {
      if (msg.type() === 'info') {
        displayed = msg.text();
      }
    });

    // Go on the page
    await goto_expect_n_gql(page, routes.Stores_Metadata, 1);

    expect(displayed).toBe(`{"data":{"session":"1234-Houdini-Token-5678"}}`);

    //Click the button
    // Mutate the data (that will be displayed in the console)
    await expect_1_gql(page, 'button[id=mutate]');

    expect(displayed).toBe(
      `{"data":{"updateUser":{"id":"list-store-user-subunsub:5","name":"Hello!"}}}`
    );
  });
});
