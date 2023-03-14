import { expect, test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { goto } from '../../../lib/utils/testsHelper.js';

test('list fragment', async ({ page }) => {
  await goto(page, routes.Lists_fragment);
  const result = await page.locator('#result').textContent({ timeout: 2997 });
  expect(result).toEqual(
    `Bruce Willis - Value1Samuel Jackson - Value1Morgan Freeman - Value1Tom Hanks - Value1Will Smith - Value1Harrison Ford - Value1Eddie Murphy - Value1Clint Eastwood - Value1`
  );
});
