import { stry } from '@kitql/helper';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/stores/network');
});

test.describe('NETWORK Page', () => {
  test('We are on the right page', async ({ page }) => {
    expect(await page.textContent('h1')).toBe('NETWORK');
  });

  test('we have no li element(s) in <ul></ul> (no data from SSR)', async ({ page, browser }) => {
    const ele = await page.content();
    expect(ele).toContain('<ul></ul>');
  });

  test('Getting the right data in a network mode', async ({ page }) => {
    const res = await page.waitForResponse('http://localhost:4000/graphql');
    const json = await res.json();
    expect(stry(json, 0)).toBe(
      '{"data":{"usersList":[{"id":"1","name":"Bruce Willis","birthDate":-466736400000},{"id":"2","name":"Samuel Jackson","birthDate":-663642000000}]}}'
    );
  });
});
