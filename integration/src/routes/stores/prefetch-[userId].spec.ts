import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../lib/utils/testsHelper.js';

test.describe('prefetch-[userId] Page', () => {
  test('Right Data in <h1> elements (SSR)', async ({ page }) => {
    await page.goto(routes.Stores_Prefetch_UserId_2);

    await expectNoGraphQLRequest(page);

    const dataDisplayedCache =
      '{"data":{"user":{"id":"store-user-query:2","name":"Samuel Jackson"}},"errors":null,"isFetching":false,"partial":false,"source":"cache","variables":{"id":"2"}}';

    // The page should have the right data directly
    let result = await page.locator('div[id=result]').textContent();
    expect(result?.trim(), 'div result').toBe(dataDisplayedCache);

    // Hovering previous link should not change the data displayed
    let response = await expectGraphQLResponse(page, 'a[id=previous]', 'hover');
    expect(JSON.parse(response ?? '{}').data.user.id).toBe('store-user-query:1'); // Should get the right data
    result = await page.locator('div[id=result]').textContent();
    expect(result?.trim(), 'div result').toBe(dataDisplayedCache);

    // Hovering next link should not change the data displayed
    response = await expectGraphQLResponse(page, 'a[id=next]', 'hover');
    expect(JSON.parse(response ?? '{}').data.user.id).toBe('store-user-query:3'); // Should get the right data
    result = await page.locator('div[id=result]').textContent();
    expect(result?.trim(), 'div result').toBe(dataDisplayedCache);

    // Hovering again previous link should not trigger a new request (it's already ion the cache) AND should not change sur data displayed
    await page.hover('a[id=previous]');
    await expectNoGraphQLRequest(page);
    result = await page.locator('div[id=result]').textContent();
    expect(result?.trim(), 'div result').toBe(dataDisplayedCache);
  });
});
