import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_0_gql, goto_expect_n_gql, navSelector } from '../../lib/utils/testsHelper.js';

test.describe('Layout & comp', () => {
  test('From page 2 to index the store should still be filled', async ({ page }) => {
    await goto_expect_n_gql(page, routes.Stores_Layouts_page2, 2);

    const pContent = await page.locator('p').allTextContents();
    expect(pContent).toEqual([
      'Query Comp - Number of users: 3',
      'Query Comp - Number of users: 3'
    ]);

    await expect_0_gql(page, navSelector(routes.Stores_Layouts));

    const pContentIndex = await page.locator('p').allTextContents();
    expect(pContentIndex).toEqual(['Query Comp - Number of users: 3']);
  });
});
