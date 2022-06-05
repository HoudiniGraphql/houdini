import { sleep, stry } from '@kitql/helper';
import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.ts';
import { expectNoGraphQLRequest } from '../../lib/utils/testsHelper.ts';

test.describe('Mutation Page', () => {
  test('No GraphQL request & default data in the store', async ({ page }) => {
    await page.goto('/preprocess/mutation/mutation');

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toEqual('Bruce Willis');

    // load the new data
    await page.locator('div[id=refetch]').click();

    // make sure the fragment store updated
    div = await page.locator('div[id=result]').textContent();
    expect(div).toEqual('Samuel Jackson');
  });
});
