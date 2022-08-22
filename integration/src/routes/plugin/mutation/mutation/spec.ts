import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expectToBe,
  goto,
  locator_click
} from '../../../../lib/utils/testsHelper.js';

test.describe('Mutation Preprocessor', () => {
  test('happy path', async ({ page }) => {
    await goto(page, routes.Plugin_mutation_mutation);

    await expectToBe(page, 'Will Smith');

    // trigger the mutation
    await expect_1_gql(page, 'button[id=mutate]');
    await expectToBe(page, 'tmp name update');

    // revert the mutation
    await locator_click(page, 'button[id=revert]');
  });
});
