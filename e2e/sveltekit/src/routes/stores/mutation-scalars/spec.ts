import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, goto, expect_to_be } from '../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('mutation store', function () {
  test('mutation inputs and values get marshaled into complex values', async function ({ page }) {
    await goto(page, routes.Stores_Mutation_Scalars);

    // trigger the mutation and wait for a response
    await expect_1_gql(page, 'button[id=mutate]');

    // make sure that the result updated with unmarshaled data
    await expect_to_be(
      page,
      '{"updateUser":{"id":"update-user-mutation:6","name":"Harrison Ford","birthDate":"1986-11-07T00:00:00.000Z"}}'
    );
  });
});
