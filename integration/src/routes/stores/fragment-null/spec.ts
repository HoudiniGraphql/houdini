import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectToBe } from '../../../lib/utils/testsHelper.js';

test.describe('fragment store', function () {
  test('accepts and returns null values', async function ({ page }) {
    page.goto(routes.Stores_Mutation_Scalars);

    // make sure that the result updated with unmarshaled data
    await expectToBe(page, 'null');
  });
});
