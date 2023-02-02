import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../../lib/utils/testsHelper.js';

test.describe('query endpoint', () => {
  test('happy path query ', async ({ page }) => {
    await goto(page, routes.Stores_Endpoint_Query);

    await expect_to_be(page, 'Hello World! // From Houdini!');
  });
});
