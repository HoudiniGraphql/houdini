import { sleep, stry } from '@kitql/helper';
import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectNoGraphQLRequest, expectToBe } from '../../lib/utils/testsHelper.js';

test.describe('Mutation Page', () => {
  test('No GraphQL request & default data in the store', async ({ page }) => {
    await page.goto(routes.Stores_Mutation);

    await expectNoGraphQLRequest(page);

    let defaultStoreValues = {
      data: null,
      errors: null,
      isFetching: false,
      isOptimisticResponse: false,
      variables: null
    };
    await expectToBe(page, stry(defaultStoreValues) ?? '', 'pre');
  });

  test('Add User + Optimistic + Result', async ({ page }) => {
    await page.goto(routes.Stores_Mutation);

    const buttonAdd = page.locator(`button[id="mutate"]`);

    // 1 Optimistic Response
    // Await the click to have optimisticResponse data in the store
    await buttonAdd.click();
    let optiStoreValues = {
      data: {
        addUser: {
          birthDate: '1986-11-07T00:00:00.000Z',
          id: '???',
          name: '...optimisticResponse... I could have guessed JYC!'
        }
      },
      errors: null,
      isFetching: true,
      isOptimisticResponse: true,
      variables: {
        birthDate: '1986-11-07T00:00:00.000Z',
        delay: 1000,
        name: 'JYC'
      }
    };
    await expectToBe(page, stry(optiStoreValues) ?? '', 'pre');

    // 2 Real Response
    await sleep(2000); // The fake delai is of 2 sec
    const pre = await page.locator('pre').textContent();
    expect(pre?.trim(), 'Content of <pre> element').not.toContain('...optimisticResponse...'); // So it's the real response (id can change... That's why we don't compare a full result)
    expect(pre?.trim(), 'Content of <pre> element').toContain('"isOptimisticResponse": false');
  });
});
