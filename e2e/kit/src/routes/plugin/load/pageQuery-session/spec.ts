import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_to_be, expect_0_gql } from '../../../../lib/utils/testsHelper.js';

test.describe('Page Query with Session', () => {
  test('No GraphQL request & Should display the session token', async ({ page }) => {
    await page.goto(routes.Plugin_load_pageQuerySession);

    await expect_0_gql(page);

    await expect_to_be(page, '1234-Houdini-Token-5678');
  });
});
