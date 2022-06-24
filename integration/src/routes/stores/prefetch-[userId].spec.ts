import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe
} from '../../lib/utils/testsHelper.js';

test.describe('prefetch-[userId] Page', () => {
  test('Right Data in <h1> elements (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_Prefetch_UserId_2);

    await expectNoGraphQLRequest(page);

    const dataDisplayedCache =
      '{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}},"errors":null,"isFetching":false,"partial":false,"source":"network","variables":{"id":"2"}}';

    // The page should have the right data directly
    await expectToBe(page, dataDisplayedCache);

    // Hovering previous link should not change the data displayed
    let response = await expectGraphQLResponse(page, 'a[id=previous]', 'hover');
    expect(JSON.parse(response ?? '{}').data.user.id).toBe('store-user-query:1'); // Should get the right data
    await expectToBe(page, dataDisplayedCache);

    // Hovering next link should not change the data displayed
    response = await expectGraphQLResponse(page, 'a[id=next]', 'hover');
    expect(JSON.parse(response ?? '{}').data.user.id).toBe('store-user-query:3'); // Should get the right data
    await expectToBe(page, dataDisplayedCache);

    // Hovering again previous link should not trigger a new request (it's already ion the cache) AND should not change sur data displayed
    await expectNoGraphQLRequest(page, `a[id=previous]`, 'hover');
    await expectToBe(page, dataDisplayedCache);
  });
});
