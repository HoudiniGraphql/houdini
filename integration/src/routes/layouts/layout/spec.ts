import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import {
  clientSideNavigation,
  expectNoGraphQLRequest,
  goto_and_expectNGraphQLResponse
} from '../../../lib/utils/testsHelper.js';

test.describe('Layout & comp', () => {
  test('From page 2 to index the store should still be filled', async ({ page }) => {
    await goto_and_expectNGraphQLResponse(page, routes.Stores_Layouts_page2, 2);

    const pContent = await page.locator('p').allTextContents();
    expect(pContent).toEqual([
      'Query Comp - Number of users: 3',
      'Query Comp - Number of users: 3'
    ]);

    await clientSideNavigation(page, routes.Stores_Layouts);
    await expectNoGraphQLRequest(page);
    const pContentIndex = await page.locator('p').allTextContents();
    expect(pContentIndex).toEqual(['Query Comp - Number of users: 3']);
  });
});
