import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, expect_1_gql, goto_expect_n_gql } from '../../../lib/utils/testsHelper.js';

test.describe('Partial Pages', () => {
  test("overlapping nested routes shouldn't trigger - from parent", async ({ page }) => {
    // Go on the page
    await goto_expect_n_gql(page, routes.Stores_Partial_Off, 0);

    // we shouldn't start with a partial result
    await expect_to_be(page, '[false]');

    // click on the link to the child page and wait for the result
    await expect_1_gql(page, '#child');

    // make sure we still didn't see a partial (this is [true] in a failing case)
    await expect_to_be(page, '[false]');
  });

  test("overlapping nested routes shouldn't trigger - from child", async ({ page }) => {
    // Go on the page
    await goto_expect_n_gql(page, routes.Stores_Partial_Off_Child, 0);

    // we shouldn't start with a partial result
    await expect_to_be(page, '[false]');

    // click on the link to the child page and wait for the result
    await expect_1_gql(page, '#parent');

    // make sure we still didn't see a partial (this is [true] in a failing case)
    await expect_to_be(page, '[false]');
  });
});
