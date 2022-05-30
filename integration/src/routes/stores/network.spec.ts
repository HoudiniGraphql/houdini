import { stry } from '@kitql/helper';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {});

test.describe('NETWORK Page', () => {
  test('we have no li element(s) in <ul></ul> (no data from SSR)', async ({ page, browser }) => {
    const testData = ''; // To replace real data coming from the network
    await page.route('**/graphql', (route) =>
      route.fulfill({
        status: 200,
        body: testData
      })
    );
    await page.goto('/stores/network');

    const ele = await page.content();
    expect(ele).toContain('<ul></ul>');
  });

  test('Getting the right data in a network mode', async ({ page }) => {
    await page.goto('/stores/network');
    const res = await page.waitForResponse('http://localhost:4000/graphql');
    const json = await res.json();
    expect(stry(json, 0)).toBe(
      '{"data":{"usersList":[{"id":"1","name":"Bruce Willis","birthDate":-466732800000},{"id":"2","name":"Samuel Jackson","birthDate":-663638400000}]}}'
    );
  });
});
