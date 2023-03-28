import { sleep } from '@kitql/helper';
import { test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_to_be, goto_expect_n_gql } from '../../lib/utils/testsHelper.js';

test.describe('Fragment Masking Partial Hits', () => {
  test('Fragment of page query should load completely', async ({ page }) => {
    await goto_expect_n_gql(page, routes.fragment_masking_partial, 0);

    // wait 1 second for masking to be applied
    await sleep(1000);

    await expect_to_be(
      page,
      '{"id":"1","name":"Alexandria","libraries":[{"id":"1","name":"The Library of Alexandria"},{"id":"2","name":"Bibliotheca Alexandrina"}],"__typename":"City"}'
    );
  });
});
