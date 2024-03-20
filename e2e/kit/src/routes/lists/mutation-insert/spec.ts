import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expect_to_be, goto, locator_click } from '../../../lib/utils/testsHelper.js';

test('mutation list insert with @with directive', async ({ page }) => {
  await goto(page, routes.Lists_mutation_insert);

  // Verify the initial page data
  await expect_to_be(
    page,
    'Bruce Willis - Hello worldSamuel Jackson - Hello worldMorgan Freeman - Hello worldTom Hanks - Hello worldWill Smith - Hello world'
  );

  // Add a user
  await locator_click(page, `button[id="addusers"]`);

  // Verify new user is at the top
  await expect_to_be(
    page,
    'Test User - Hello worldBruce Willis - Hello worldSamuel Jackson - Hello worldMorgan Freeman - Hello worldTom Hanks - Hello worldWill Smith - Hello world'
  );
});
