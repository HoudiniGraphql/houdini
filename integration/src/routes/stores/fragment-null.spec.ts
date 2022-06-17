import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe
} from '../../lib/utils/testsHelper.js';

test.describe('fragment store', function () {
  test('accepts and returns null values', async function ({ page }) {
    page.goto(routes.Stores_Mutation_Scalars);

    await expectNoGraphQLRequest(page);

    // make sure that the result updated with unmarshaled data
    await expectToBe(page, 'null');
  });
});
