import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import { expectToBe, goto } from '../../../../lib/utils/testsHelper';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await goto(page, routes.Plugin_query_beforeLoad);

    await expectToBe(page, 'hello: Bruce Willis');
  });
});
