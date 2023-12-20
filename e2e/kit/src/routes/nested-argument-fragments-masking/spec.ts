import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_1_gql, expect_to_be, goto } from '../../lib/utils/testsHelper.js';
import { sleep } from '@kitql/helpers';

test('Nested fragment argument masking', async ({ page }) => {
  await goto(page, routes.nested_argument_fragments_masking);

  // wait a bit for the client to hydrate
  await sleep(1000);

  expect(await page.locator('#result').textContent({ timeout: 2997 })).toMatchSnapshot();
});
