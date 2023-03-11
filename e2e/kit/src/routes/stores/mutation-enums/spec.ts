import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, expect_to_be, goto } from '../../../lib/utils/testsHelper.js';

test.describe('mutation store', function () {
  test('can pass enums to mutations', async function ({ page }) {
    await goto(page, routes.Stores_Mutation_Enums);

    // trigger the mutation and wait for a response
    await expect_1_gql(page, 'button[id=mutate]');

    // make sure that the result updated with unmarshaled data
    await expect_to_be(page, 'true');

    // make sure that the result updated with unmarshaled data
    await expect_to_be(page, '["COOL","NICE"]', 'div[id=result-type]');
  });
});
