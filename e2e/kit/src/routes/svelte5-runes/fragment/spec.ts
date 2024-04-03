import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, goto } from '../../../lib/utils/testsHelper.js';

test.describe('Svelte 5 runes fragments', () => {
  test('Fragments contain data on pagination', async ({ page }) => {
    await goto(page, routes.Svelte5_Runes_Fragment);

    const dataStages = [
      ['Bruce Willis - Born on: Sat Mar 19 1955', 'Samuel Jackson - Born on: Tue Dec 21 1948'],
      [
        'Bruce Willis - Born on: Sat Mar 19 1955',
        'Samuel Jackson - Born on: Tue Dec 21 1948',
        'Morgan Freeman - Born on: Mon May 31 1937',
        'Tom Hanks - Born on: Mon Jul 09 1956'
      ],
      [
        'Bruce Willis - Born on: Sat Mar 19 1955',
        'Samuel Jackson - Born on: Tue Dec 21 1948',
        'Morgan Freeman - Born on: Mon May 31 1937',
        'Tom Hanks - Born on: Mon Jul 09 1956',
        'Will Smith - Born on: Wed Sep 25 1968',
        'Harrison Ford - Born on: Mon Jul 13 1942'
      ],
      [
        'Bruce Willis - Born on: Sat Mar 19 1955',
        'Samuel Jackson - Born on: Tue Dec 21 1948',
        'Morgan Freeman - Born on: Mon May 31 1937',
        'Tom Hanks - Born on: Mon Jul 09 1956',
        'Will Smith - Born on: Wed Sep 25 1968',
        'Harrison Ford - Born on: Mon Jul 13 1942',
        'Eddie Murphy - Born on: Mon Apr 03 1961',
        'Clint Eastwood - Born on: Tue Jul 01 1930'
      ]
    ];

    const li = page.locator('li');

    // Check the initial stage
    const count = await li.count();
    expect(count, 'number of <li> elements').toBe(dataStages[0].length);

    for (let n = 0; n < dataStages[0].length; n++) {
      const text = await li.nth(n).textContent();
      expect(text).toBe(dataStages[0][n]);
    }

    // Load next pages
    for (let i = 1; i < dataStages.length; i++) {
      const stage = dataStages[i];

      // We should have only 1 graphql request
      await expect_1_gql(page, 'button[id=next]');

      // Check the nr of li elements to the expected data
      const count = await li.count();
      expect(count, 'number of <li> elements').toBe(stage.length);

      // Check if each li element correspends with the expected data
      for (let n = 0; n < count; n++) {
        const text = await li.nth(n).textContent();
        expect(text, '<li> element text').toBe(stage[n]);
      }
    }
  });
});
