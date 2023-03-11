import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, expect_n_gql, goto, navSelector } from '../../../lib/utils/testsHelper.js';

test.describe('+Layout.gql', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await goto(page, routes.nested_routes);
    await expect_to_be(page, 'Samuel Jackson Samuel Jackson', 'h3');
  });

  test('From HOME, navigate to page (only 1 graphql queries should happen, not more!)', async ({
    page
  }) => {
    await goto(page, routes.Home);

    const listStr = await expect_n_gql(page, navSelector(routes.nested_routes), 1);
    const expected = [`{"data":{"user":{"id":"Page_User:2","name":"Samuel Jackson"}}}`];
    expect(listStr).toStrictEqual(expected);
  });
});
