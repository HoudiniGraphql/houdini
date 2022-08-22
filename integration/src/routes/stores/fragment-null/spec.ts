import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../lib/utils/testsHelper.js';

test.describe('fragment store', function () {
  test('accepts and returns null values', async function ({ page }) {
    goto(page, routes.Stores_Mutation_Scalars);

    // make sure that the result updated with unmarshaled data
    await expectToBe(page, 'null');
  });
});
