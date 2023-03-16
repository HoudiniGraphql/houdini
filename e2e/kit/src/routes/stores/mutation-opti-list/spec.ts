import { sleep } from '@kitql/helper';
import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto, locator_click } from '../../../lib/utils/testsHelper.js';

test('Add User + Optimistic + List', async ({ page }) => {
  await goto(page, routes.Stores_Mutation_Opti_List);

  // initial data
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
  );

  // 1 Optimistic Response
  // Await the click to have optimisticResponse data in the store
  await locator_click(page, `button[id="mutate"]`);

  // with optimisticResponse, the data is updated before the real response
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood, ...optimisticResponse... I could have guessed JYC!'
  );

  // 2 Real Response
  await sleep(2000); // The fake delai is of 1 sec
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood, JYC'
  );
});
