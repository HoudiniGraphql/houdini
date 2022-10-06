import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes';
import { expectToBe, goto } from '../../../lib/utils/testsHelper';

test.describe('query endpoint', () => {
  test('happy path query ', async ({ page }) => {
    await goto(page, routes.Stores_Endpoint_Query);

    await expectToBe(page, 'Hello World! // From Houdini!');
  });
});
