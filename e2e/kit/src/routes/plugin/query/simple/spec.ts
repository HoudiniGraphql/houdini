import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expect_to_be,
  goto,
  navSelector
} from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('happy path query - SRR', async ({ page }) => {
    await goto(page, routes.Plugin_query_simple);

    await expect_to_be(page, 'Bruce Willis');
  });

  test('happy path query - Network', async ({ page }) => {
    // Go to home
    await goto(page, routes.Home);

    const result = await expect_1_gql(page, navSelector(routes.Plugin_query_simple));
    expect(result).toBe(
      '{"data":{"user":{"id":"preprocess-query-simple:1","name":"Bruce Willis"}}}'
    );

    await expect_to_be(page, 'Bruce Willis');
  });
});
