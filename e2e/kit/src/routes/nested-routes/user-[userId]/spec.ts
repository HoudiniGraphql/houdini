import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, expect_n_gql, goto, navSelector } from '../../../lib/utils/testsHelper.js';

test.describe('+Layout.gql', () => {
  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    await goto(page, routes.nested_routes);
    const result = await page.locator('h3').textContent({ timeout: 2997 });
    expect(result?.replaceAll('\n', '').replaceAll(/\s+/g, ' ')).toBe(
      'Samuel Jackson Samuel Jackson'
    );
  });

  test('From HOME, navigate to page (only 1 graphql queries should happen, not more!)', async ({
    page
  }) => {
    await goto(page, routes.Home);

    const listStr = await expect_n_gql(page, navSelector(routes.nested_routes), 1);
    expect(JSON.parse(listStr[0])).toMatchObject({
      data: { user: { id: 'Page_User:2', name: 'Samuel Jackson' } }
    });
  });
});
