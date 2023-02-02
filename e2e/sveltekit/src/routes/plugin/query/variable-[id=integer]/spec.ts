import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expect_to_be,
  goto,
  navSelector
} from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor variables', () => {
  test('default value', async ({ page }) => {
    await goto(page, routes.Plugin_query_variable_1);

    await expect_to_be(page, 'Bruce Willis');

    await expect_to_be(page, '{"id":"1"}', '#variables');

    // We should have the data with only 1 GraphQL request in the client
    await expect_1_gql(page, navSelector(routes.Plugin_query_variable_2));

    await expect_to_be(page, 'Samuel Jackson');

    await expect_to_be(page, '{"id":"2"}', '#variables');
  });

  test("using the integer matcher doesn't log anything to the console", async ({ page }) => {
    // listen to the console
    let displayed = '';
    page.on('console', (msg) => {
      if (msg.type() === 'info') {
        displayed = msg.text();
      }
    });

    // go to the page with the matcher
    await goto(page, routes.Plugin_query_variable_1);

    // make sure nothing was logged
    expect(displayed).toEqual('');
  });
});
