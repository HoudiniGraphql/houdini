import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectToBe, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('Mutation Preprocessor', () => {
  test('happy path', async ({ page }) => {
    await goto(page, routes.Plugin_mutation_mutation);

    await expectToBe(page, 'Will Smith');

    // trigger the mutation
    await expectGraphQLResponse(page, 'button[id=mutate]');
    await expectToBe(page, 'tmp name update');

    // revert the mutation
    await page.locator('button[id=revert]').click();
  });
});
