import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_to_be, goto_expect_n_gql } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('component queries', async ({ page }) => {
    await goto_expect_n_gql(page, routes.Plugin_query_component, 2);

    await expect_to_be(page, 'Morgan Freeman', 'div[id=result-default]');
    await expect_to_be(page, 'Samuel Jackson', 'div[id=result-prop]');
  });
});
