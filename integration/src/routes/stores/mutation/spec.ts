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
      isFetching: false,
      isOptimisticResponse: false,
      variables: null
    };
    await expectToBe(page, stry(defaultStoreValues) ?? '', 'pre');
  });

  test('Add User + Optimistic + Result', async ({ page }) => {
    await goto(page, routes.Stores_Mutation);

    // 1 Optimistic Response
    // Await the click to have optimisticResponse data in the store
    await locator_click(page, `button[id="mutate"]`);

    const optiStoreValues = {
      data: {
        addUser: {
          birthDate: new Date('1986-11-07'),
          id: '???',
          name: '...optimisticResponse... I could have guessed JYC!'
        }
      },
      errors: null,
      isFetching: true,
      isOptimisticResponse: true,
      variables: {
        birthDate: new Date('1986-11-07'),
        delay: 1000,
        name: 'JYC'
      }
    };
    await expectToBe(page, stry(optiStoreValues) ?? '', 'pre');

    // 2 Real Response
    await sleep(2000); // The fake delai is of 1 sec

    const pre = await page.locator('pre').textContent();
    expect(pre?.trim(), 'Content of <pre> element').not.toContain('...optimisticResponse...'); // So it's the real response (id can change... That's why we don't compare a full result)
    expect(pre?.trim(), 'Content of <pre> element').toContain('"isOptimisticResponse": false');
  });
});
