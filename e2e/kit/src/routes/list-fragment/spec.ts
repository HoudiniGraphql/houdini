import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_to_be, goto } from '../../lib/utils/testsHelper.js';

test('list fragment', async ({ page }) => {
  await goto(page, routes.list_fragment);
  await expect_to_be(
    page,
    'Bruce Willis - Value1Samuel Jackson - Value1Morgan Freeman - Value1Tom Hanks - Value1Will Smith - Value1Harrison Ford - Value1Eddie Murphy - Value1Clint Eastwood - Value1'
  );
});
