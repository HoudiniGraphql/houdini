import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes';
import {
  clientSideNavigation,
  expect_1_gql,
  expectToBe,
  goto_expect_n_gql
} from '../../../lib/utils/testsHelper';

test.describe('SubUnsub Page', () => {
  test('Sub > Unsub > Mutate > Sub => Data should be updated & displayed', async ({ page }) => {
    // Go to the list and subscribe to the list
    await goto_expect_n_gql(page, routes.Stores_subunsub_list, 1);

    await expectToBe(
      page,
      'list-store-user-subunsub:1 - Bruce Willis list-store-user-subunsub:2 - Samuel Jackson list-store-user-subunsub:3 - Morgan Freeman list-store-user-subunsub:4 - Tom Hanks',
      'ul'
    );

    // Go to another page (and unsubscribe the list)
    await clientSideNavigation(page, routes.Stores_subunsub_mutation);

    // Mutate the data (that will be displayed in the list)
    await expect_1_gql(page, 'button[id=mutate]');

    // Go back to the list page and check that the data are updated
    await clientSideNavigation(page, routes.Stores_subunsub_list);

    expectToBe(
      page,
      'list-store-user-subunsub:1 - JYC & Alec! list-store-user-subunsub:2 - Samuel Jackson list-store-user-subunsub:3 - Morgan Freeman list-store-user-subunsub:4 - Tom Hanks',
      'ul'
    );
  });
});
