import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { goto } from '../../../lib/utils/testsHelper.js';

test('list fragment', async ({ page }) => {
  await goto(page, routes.Lists_fragment);
  const result = await page.locator('#result').textContent({ timeout: 2997 });
  expect(result).toMatchSnapshot();
});
