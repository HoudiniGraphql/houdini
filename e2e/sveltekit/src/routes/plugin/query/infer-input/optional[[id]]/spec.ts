import { test } from '@playwright/test';
import { routes } from '../../../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../../../lib/utils/testsHelper.js';

test.describe('query variables from route params', () => {
  test('optional param in query,  no value', async ({ page }) => {
    await goto(page, routes.Plugin_query_inferInput_optional);

    await expectToBe(page, 'Bruce Willis');
  });
});
