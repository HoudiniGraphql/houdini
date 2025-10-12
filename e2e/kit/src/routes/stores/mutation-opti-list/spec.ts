import { sleep } from '@kitql/helpers';
import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto, locator_click } from '../../../lib/utils/testsHelper.js';

// We put everything in one test because we are on the same snapshot. We will do null, error and success!
test('Add User + Optimistic + List', async ({ page }) => {
  await goto(page, routes.Stores_Mutation_Opti_List);

  // initial data
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
  );

  // 1 Optimistic Response (null)
  // Await the click to have optimisticResponse data in the store
  await locator_click(page, `button[id="mutate-null"]`);

  // with optimisticResponse, the data is updated before the real response
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood, ...optimisticResponse... I could have guessed JYC!'
  );

  // 2 Real Response (null)
  await sleep(1000); // The fake delai is of 500 ms delay
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
  );

  // 3 Optimistic Response (error)
  // Await the click to have optimisticResponse data in the store
  await locator_click(page, `button[id="mutate-error"]`);

  // with optimisticResponse, the data is updated before the real response
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood, ...optimisticResponse... I could have guessed JYC!'
  );

  // 4 Real Response (error)
  await sleep(1000); // The fake delai is of 500 ms delay
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
  );

  // 5 Optimistic Response
  // Await the click to have optimisticResponse data in the store
  await locator_click(page, `button[id="mutate"]`);

  // with optimisticResponse, the data is updated before the real response
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood, ...optimisticResponse... I could have guessed JYC!'
  );

  // 6 Real Response
  await sleep(1000); // The fake delai is of 500 ms delay
  await expect_to_be(
    page,
    'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood, JYC'
  );
});
