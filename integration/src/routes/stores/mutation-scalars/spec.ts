import { routes } from '../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe
} from '../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('mutation store', function () {
  test('mutation inputs and values get marshaled into complex values', async function ({ page }) {
    page.goto(routes.Stores_Mutation_Scalars);

    await expectNoGraphQLRequest(page);

    // trigger the mutation and wait for a response
    await expectGraphQLResponse(page, 'button[id=mutate]');

    // make sure that the result updated with unmarshaled data
    await expectToBe(
      page,
      '{"updateUser":{"id":"store-user-query:6","name":"Harrison Ford","birthDate":"1986-11-07T00:00:00.000Z"}}'
    );
  });
});
