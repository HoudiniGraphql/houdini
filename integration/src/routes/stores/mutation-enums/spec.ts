import { routes } from '../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe
} from '../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('mutation store', function () {
  test('can pass enums to mutations', async function ({ page }) {
    page.goto(routes.Stores_Mutation_Enums);

    await expectNoGraphQLRequest(page);

    // trigger the mutation and wait for a response
    await expectGraphQLResponse(page, 'button[id=mutate]');

    // make sure that the result updated with unmarshaled data
    await expectToBe(page, 'true');

    // make sure that the result updated with unmarshaled data
    await expectToBe(page, '["COOL","NICE"]', 'div[id=result-type]');
  });
});
