import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../lib/utils/testsHelper.js';

test.describe('Mutation Update Page', () => {
  test('Right Data, mutation, list update, revet', async ({ page }) => {
    await page.goto(routes.Stores_Mutation_Update);

    const data = [
      '1 - Bruce Willis',
      '2 - Samuel Jackson',
      '3 - Morgan Freeman',
      '4 - Tom Hanks',
      '5 - Will Smith'
    ];

    const dataUpdated = [
      '1 - Bruce Willis',
      '2 - Samuel Jackson',
      '3 - Morgan Freeman',
      '4 - Tom Hanks',
      '5 - tmp name update'
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
    const buttonUpdate = page.locator(`button[id="mutate"]`);
    buttonUpdate.click();
    // 2.1 One request should happen
    await expectGraphQLResponse(page);
    // 2.1 No second one!
    await expectNoGraphQLRequest(page);
    li = page.locator('li');
    for (let i = 0; i < count; ++i) {
      const text = await li.nth(i).textContent();
      expect(text?.trim(), 'Content of <li> element').toBe(dataUpdated[i]);
    }

    // 3 Revert data
    const buttonRevert = page.locator(`button[id="revert"]`);
    await buttonRevert.click();
    li = page.locator('li');
    for (let i = 0; i < count; ++i) {
      const text = await li.nth(i).textContent();
      expect(text?.trim(), 'Content of <li> element').toBe(data[i]);
    }
  });
});
