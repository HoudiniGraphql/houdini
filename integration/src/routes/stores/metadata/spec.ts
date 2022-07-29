import { sleep } from '@kitql/helper';
import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectGraphQLResponse } from '../../lib/utils/testsHelper.js';

test.describe('Metadata Page', () => {
  test('Query => Should display the raw result in the console as info', async ({ page }) => {
    // Listen to the console
    let displayed = '';
    page.on('console', (msg) => {
      if (msg.type() === 'info') displayed = msg.text();
    });

    // Go on the page
    await page.goto(routes.Stores_Metadata);

    // Wait a bit
    await sleep(999);

    expect(displayed).toBe(`{"data":{"session":"1234-Houdini-Token-5678"}}`);
  });

  test('Mutation => Should display the raw result in the console as info', async ({ page }) => {
    // Go on the page
    await page.goto(routes.Stores_Metadata);

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
