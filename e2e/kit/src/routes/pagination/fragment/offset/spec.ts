import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expect_1_gql, expect_to_be, goto } from '../../../../lib/utils/testsHelper.js';

test.describe('offset paginatedFragment', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Pagination_fragment_offset);

    await expect_to_be(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expect_1_gql(page, 'button[id=next]');

    // make sure we got the new content
    await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });
});
