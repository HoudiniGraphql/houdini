import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, goto } from '../../../lib/utils/testsHelper.js';

test.describe('Mutation Update Fragment Page', () => {
  test('Right Data, update', async ({ page }) => {
    await goto(page, routes.Stores_Mutation_Update_Fragment);

    const pageCounter = page.locator('#counter-page');
    const componentCounter = page.locator('#counter-component');

    // 1 Right initial data
    expect(await pageCounter.textContent(), 'initial page counter').toBe('0');
    expect(await componentCounter.textContent(), 'initial page counter').toBe('0');

    // 2 Updated data
    // 2.1 One request should happen
    await expect_1_gql(page, 'button');

    // 2.2 Right incremented data
    expect(await pageCounter.textContent(), 'incremented page counter').toBe('1');
    expect(await componentCounter.textContent(), 'incremented page counter').toBe('1');
  });
});
