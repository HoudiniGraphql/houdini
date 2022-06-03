import { sleep, stry } from '@kitql/helper';
import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.ts';
import { expectNoGraphQLRequest } from '../../lib/utils/testsHelper.ts';

test.describe('Mutation Page', () => {
  test('No GraphQL request & default data in the store', async ({ page }) => {
    await page.goto(routes.Stores_Mutation);

    await expectNoGraphQLRequest(page);
    let pre = await page.locator('pre').textContent();
    let defaultStoreValues = {
      data: null,
      errors: null,
      isFetching: false,
      isOptimisticResponse: false,
      variables: null
    };
    expect(pre?.trim(), 'Content of <pre> element').toBe(stry(defaultStoreValues));
  });

  test('Add User + Optimistic + Result', async ({ page }) => {
    await page.goto(routes.Stores_Mutation);

    const buttonAdd = page.locator(`button[id="mutate"]`);

    // 1 Optimistic Response
    // Await the click to have optimisticResponse data in the store
    await buttonAdd.click();
    let pre = await page.locator('pre').textContent();
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
    expect(pre?.trim(), 'Content of <pre> element').toBe(stry(optiStoreValues));

    // 2 Real Response
    await sleep(2000); // The fake delai is of 2 sec
    pre = await page.locator('pre').textContent();
    expect(pre?.trim(), 'Content of <pre> element').not.toContain('...optimisticResponse...'); // So it's the real response (id can change... That's why we don't compare a full result)
    expect(pre?.trim(), 'Content of <pre> element').toContain('"isOptimisticResponse": false');
  });
});
