import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, expect_0_gql, expect_to_be, goto } from '../../../lib/utils/testsHelper.js';
import { expect, test } from '@playwright/test';

test.describe('prefetch-[userId] Page', () => {
  test('Right Data in <h1> elements (SSR)', async ({ page }) => {
    await goto(page, routes.Stores_Prefetch_UserId_2);

    const dataDisplayedSSR =
      '{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}},"errors":null,"fetching":false,"partial":false,"source":"network","stale":false,"variables":{"id":"2"}}';

    // The page should have the right data directly
    await expect_to_be(page, dataDisplayedSSR);

    // Hovering previous link should not change the data displayed
    let response = await expect_1_gql(page, 'a[id=previous]', 'hover');
    expect(JSON.parse(response ?? '{}').data.user.id).toBe('store-user-query:1'); // Should get the right data
    // Data displayed should still be the same
    await expect_to_be(page, dataDisplayedSSR);

    // Hovering next link should not change the data displayed
    response = await expect_1_gql(page, 'a[id=next]', 'hover');
    expect(JSON.parse(response ?? '{}').data.user.id).toBe('store-user-query:3'); // Should get the right data
    // Data displayed should still be the same
    await expect_to_be(page, dataDisplayedSSR);

    // Hovering again previous link should not trigger a new request (it's already in the cache) AND should not change sur data displayed
    await expect_0_gql(page, `a[id=previous]`, 'hover');
    // Data displayed should still be the same
    await expect_to_be(page, dataDisplayedSSR);
  });
});
