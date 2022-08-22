import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { goto } from '../../../lib/utils/testsHelper.js';

test.describe('Mutations', () => {
  test('Work in Endpoints', async ({ page }) => {
    await goto(page, routes.Stores_Endpoint_Mutation);

    // click on the button and make sure there's no error
    await Promise.all([
      // Waits for the next response with the specified url
      page.waitForResponse(routes.Stores_Endpoint_Mutation),
      // Triggers the response
      page.click('button')
    ]);

    const status = await page.textContent('#result');
    expect(status).toEqual('200');
  });
});
