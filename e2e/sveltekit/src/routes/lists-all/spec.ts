import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expectToBe, expect_n_gql, goto } from '../../lib/utils/testsHelper.js';

test.describe('lists-all', () => {
  test('With 3 lists to append', async ({ page }) => {
    await goto(page, routes.lists_all);

    // select the input
    await page.locator('input[type="number"]').click();
    // add 1 to the input to load a second list
    await expect_n_gql(page, 'input[type="number"]', 1, 'press_ArrowUp');
    // add 1 to the input to load a third list
    await expect_n_gql(page, 'input[type="number"]', 1, 'press_ArrowUp');

    // expect to have the righ data
    await expectToBe(
      page,
      'Bruce WillisSamuel JacksonMorgan FreemanTom HanksWill SmithHarrison FordEddie MurphyClint Eastwood'
    );

    // mutation to add a new actor (Expect to have 1 mutation)
    await expect_n_gql(page, 'text=Add User', 1);

    // expect to have the data added
    await expectToBe(
      page,
      'Omar SyBruce WillisSamuel JacksonMorgan FreemanTom HanksWill SmithHarrison FordEddie MurphyClint Eastwood'
    );

    // select the input
    await page.locator('input[type="number"]').click();
    // go back 1 list, expect no graphql request (from cache!)
    await expect_n_gql(page, 'input[type="number"]', 0, 'press_ArrowDown');
    // go back 1 list, expect no graphql request (from cache!)
    await expect_n_gql(page, 'input[type="number"]', 0, 'press_ArrowDown');

    // expect the data to still contain the new actor
    await expectToBe(
      page,
      'Omar SyBruce WillisSamuel JacksonMorgan FreemanTom HanksWill SmithHarrison FordEddie MurphyClint Eastwood'
    );
  });
});
