import test from '@playwright/test';
import { routes } from '../../../lib/utils/routes';
import { expect_1_gql, expect_to_be, goto } from '../../../lib/utils/testsHelper';

test.describe('Svelte 5 runes mutation', () => {
  test('run mutation', async ({ page }) => {
    await goto(page, routes.Svelte5_Runes_Mutation);

    await expect_to_be(page, 'Bruce Willis');

    await expect_1_gql(page, 'button[id=mutate]');

    await expect_to_be(page, 'Seppe');
  });
});
