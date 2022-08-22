import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../lib/utils/testsHelper.js';

test.describe('query endpoint', () => {
  test('happy path query ', async ({ page }) => {
    await goto(page, routes.Stores_Endpoint_Query);

    await expectToBe(page, JSON.stringify({ data: { hello: 'Hello World! // From Houdini!' } }));
  });
});
