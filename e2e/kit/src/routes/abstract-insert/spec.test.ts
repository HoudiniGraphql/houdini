import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_to_be } from '../../lib/utils/testsHelper.js';
import { sleep } from '@kitql/helper';

test.describe('abstract insert', () => {
  test('happy path', async ({ page }) => {
    await page.goto(routes.abstractInsert);

    // click on the insert button
    await page.click('#insert');

    await sleep(200);

    await expect_to_be(page, 'Bruce Willis0');
  });
});
