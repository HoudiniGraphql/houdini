import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be } from '../../../lib/utils/testsHelper.js';

test('abstract fragment with nested connection', async ({ page }) => {
  await page.goto(routes.abstractFragments_nestedConnection);

  await expect_to_be(page, 'Terk  King Louie');
});
