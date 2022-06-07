import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.js';

test.describe('Mutation Preprocessor', () => {
  test('happy path', async ({ page }) => {
    await page.goto(routes.Preprocess_mutation_mutation);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);
    let div = await page.locator('div[id=result]').textContent();
    expect(div).toEqual('Will Smith');

    // trigger the mutation
    await expectGraphQLResponse(page, 'button[id=mutate]');
    div = await page.locator('div[id=result]').textContent();
    expect(div).toEqual('tmp name update');

    // revert the mutation
    await page.locator('button[id=revert]').click();
  });
});
