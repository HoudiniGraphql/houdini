import { routes } from '../../../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe, goto } from '../../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('query preprocessor', () => {
  test('happy path query - SSR', async ({ page }) => {
    await goto(page, routes.Plugin_load_pageQuery);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'page-query:1');
  });
});
