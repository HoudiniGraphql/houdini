import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import { expect_1_gql, expectToBe, goto, navSelector } from '../../../../lib/utils/testsHelper';

test.describe('query preprocessor variables', () => {
  test('default value', async ({ page }) => {
    await goto(page, routes.Plugin_query_variable_1);

    await expectToBe(page, 'Bruce Willis');

    await expectToBe(page, '{"id":"1"}', '#variables');

    // We should have the data with only 1 GraphQL request in the client
    await expect_1_gql(page, navSelector(routes.Plugin_query_variable_2));

    await expectToBe(page, 'Samuel Jackson');

    await expectToBe(page, '{"id":"2"}', '#variables');
  });
});
