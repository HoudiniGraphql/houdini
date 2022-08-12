import { routes } from '../../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe
} from '../../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('Mutation Preprocessor', () => {
  test('happy path', async ({ page }) => {
    await page.goto(routes.Plugin_mutation_mutation);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);
    await expectToBe(page, 'Will Smith');

    // trigger the mutation
    await expectGraphQLResponse(page, 'button[id=mutate]');
    await expectToBe(page, 'tmp name update');

    // revert the mutation
    await page.locator('button[id=revert]').click();
  });
});
