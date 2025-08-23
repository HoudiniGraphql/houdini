import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_to_be, goto_expect_n_gql } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('component queries inside a route', async ({ page }) => {
    await goto_expect_n_gql(page, routes.Plugin_query_componentInRoute, 2);

    await expect_to_be(page, 'Bruce Willis - (1)', 'li[id=result-0]');
    await expect_to_be(page, 'Samuel Jackson - (2)', 'li[id=result-1]');
  });
});
