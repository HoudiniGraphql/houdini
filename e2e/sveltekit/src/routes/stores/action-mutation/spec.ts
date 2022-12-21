import { sleep } from '@kitql/helper';
import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectToBe, goto } from '../../../lib/utils/testsHelper.js';

test.describe('action-mutation', () => {
  test('happy path action-mutation ', async ({ page }) => {
    await goto(page, routes.Stores_action_mutation);

    await expectToBe(page, 'No user added');

    // click the button
    await Promise.all([
      page.waitForResponse((res) => res.url().endsWith('action-mutation?/add'), { timeout: 1000 }),
      page.getByRole('button', { name: 'Add' }).click()
    ]);

    // a start should be displayed
    await expectToBe(page, '*', 'span[id=name-error]');

    // fill the input
    await page.getByLabel('Name').fill('My New Name');

    // add
    await Promise.all([
      page.waitForResponse((res) => res.url().endsWith('action-mutation?/add'), { timeout: 1000 }),
      page.getByRole('button', { name: 'Add' }).click()
    ]);

    // wait for the message to appear
    await sleep(500);

    // check that we have the right data
    await expectToBe(page, 'My New Name');
  });
});
