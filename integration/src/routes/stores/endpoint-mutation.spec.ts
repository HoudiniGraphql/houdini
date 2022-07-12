import { sleep, stry } from '@kitql/helper';
import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectGraphQLResponse } from '../../lib/utils/testsHelper.js';

test.describe('Mutations', () => {
  test('Work in Endpoints', async ({ page }) => {
    await page.goto(routes.Stores_Mutation);

    await expectNoGraphQLRequest(page);

    // click on the button and make sure there's no error
    await expectGraphQLResponse(page, '#button');

    const status = await page.textContent('#result');
    expect(status).toEqual('200');
  });
});
