import { sleep } from '@kitql/helper';
import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  goto_and_expectNGraphQLResponse
} from '../../../lib/utils/testsHelper.js';

test.describe('Metadata Page', () => {
  test('Mutation => Should display the raw result in the console as info', async ({ page }) => {
    // Go on the page
    await goto_and_expectNGraphQLResponse(page, routes.Stores_Metadata, 1);

    // Wait a bit
    await sleep(999);

    // Listen to the console
    let displayed = '';
    page.on('console', (msg) => {
      if (msg.type() === 'info') displayed = msg.text();
    });

    //Click the button
    // Mutate the data (that will be displayed in the list)
    await expectGraphQLResponse(page, 'button[id=mutate]');

    expect(displayed).toBe(
      `{"data":{"updateUser":{"id":"list-store-user-subunsub:5","name":"Hello!"}}}`
    );
  });
});
