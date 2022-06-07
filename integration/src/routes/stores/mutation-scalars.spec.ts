import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../lib/utils/testsHelper.js';

test.describe('mutation store', function () {
  test('mutation inputs and values get marshaled into complex values', async function ({ page }) {
    page.goto(routes.Stores_Mutation_Scalars);

    await expectNoGraphQLRequest(page);

    // trigger the mutation and wait for a response
    await expectGraphQLResponse(page, 'button[id=mutate]');

    // make sure that the result updated with unmarshaled data
    const div = await page.locator('div[id=result]').textContent();
    expect(div).toEqual(
      '{"updateUser":{"id":"store-user-query:5","name":"Will Smith","birthDate":"1986-11-07T00:00:00.000Z"}}'
    );
  });
});
