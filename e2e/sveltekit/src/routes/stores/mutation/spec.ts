import { sleep, stry } from '@kitql/helper';
import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectToBe, goto, locator_click } from '../../../lib/utils/testsHelper.js';

test.describe('Mutation Page', () => {
  test('No GraphQL request & default data in the store', async ({ page }) => {
    await goto(page, routes.Stores_Mutation);

    const defaultStoreValues = {
      data: null,
      errors: null,
      fetching: false,
      variables: null,
      partial: false,
      stale: false,
      source: null
    };
    await expectToBe(page, stry(defaultStoreValues) ?? '', '[id="store-value"]');
  });

  test('Add User + Optimistic + Result', async ({ page }) => {
    await goto(page, routes.Stores_Mutation);

    // 1 Optimistic Response
    // Await the click to have optimisticResponse data in the store
    await locator_click(page, `button[id="mutate"]`);

    await expectToBe(page, '...optimisticResponse... I could have guessed JYC!');

    // 2 Real Response
    await sleep(2000); // The fake delai is of 1 sec

    const div = await page.locator('div[id=result]').textContent();
    expect(div?.trim()).not.toContain('...optimisticResponse...'); // So it's the real response (id can change... That's why we don't compare a full result)
  });
});
