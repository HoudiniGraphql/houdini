import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_1_gql, expect_to_be, goto } from '../../lib/utils/testsHelper.js';

test.describe('union-result', () => {
  test('Get two stores and not resetting', async ({ page }) => {
    await goto(page, routes.union_insert);

    // When we arrive on the page, we expect to see null in the result div
    await expect_to_be(page, '{"aOrB":[]}');

    // we click on the button to getAllUsers
    await expect_1_gql(page, 'button[id="addA"]');

    // expect 1 element in the array
    await expect_to_be(page, '{"aOrB":[{"id":"1","a":"MyA","__typename":"A"}]}');

    // we click on the button to getAllUsers
    await expect_1_gql(page, 'button[id="addB"]');

    // expect 2 elements in the array
    await expect_to_be(
      page,
      '{"aOrB":[{"id":"1","a":"MyA","__typename":"A"},{"id":"1","b":"MyB","__typename":"B"}]}'
    );
  });
});
