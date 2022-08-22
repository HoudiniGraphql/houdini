import { routes } from '../../../lib/utils/routes.js';
import {
  clientSideNavigation,
  expectNGraphQLResponse,
  expectNoGraphQLRequest,
  goto
} from '../../../lib/utils/testsHelper.js';
import { expect, test } from '@playwright/test';

test.describe('Layout & comp', () => {
  test('From page 2 to index the store should still be filled', async ({ page }) => {
    await goto(page, routes.Stores_Layouts_page2);
    await expectNGraphQLResponse(page, null, 2);

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
