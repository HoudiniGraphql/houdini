import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, goto } from '../../../lib/utils/testsHelper.js';

test.describe('Mutation Update Page', () => {
  test('Right Data, mutation, list update, revet', async ({ page }) => {
    await goto(page, routes.Stores_Mutation_Update);

    const data = [
      'store-user-query:1 - Bruce Willis',
      'store-user-query:2 - Samuel Jackson',
      'store-user-query:3 - Morgan Freeman',
      'store-user-query:4 - Tom Hanks',
      'store-user-query:5 - Will Smith'
    ];

    const dataUpdated = [
      'store-user-query:1 - Bruce Willis',
      'store-user-query:2 - Samuel Jackson',
      'store-user-query:3 - Morgan Freeman',
      'store-user-query:4 - Tom Hanks',
      'store-user-query:5 - tmp name update'
    ];

    // 1 Right data
    let li = page.locator('li');
    const count = await li.count();
    expect(count, 'number of <li> elements').toBe(data.length);

    for (let i = 0; i < count; ++i) {
      const text = await li.nth(i).textContent();
      expect(text?.trim(), 'Content of <li> element').toBe(data[i]);
    }

    // 2 Updated data
    // 2.1 One request should happen
    await expect_1_gql(page, 'button[id="mutate"]');

    li = page.locator('li');
    for (let i = 0; i < count; ++i) {
      const text = await li.nth(i).textContent();
      expect(text?.trim(), 'Content of <li> element').toBe(dataUpdated[i]);
    }

    // 3 Revert data
    await expect_1_gql(page, 'button[id="revert"]');
    li = page.locator('li');
    for (let i = 0; i < count; ++i) {
      const text = await li.nth(i).textContent();
      expect(text?.trim(), 'Content of <li> element').toBe(data[i]);
    }
  });
});
