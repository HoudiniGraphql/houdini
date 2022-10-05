import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import { expect_1_gql, expectToBe, goto } from '../../../../lib/utils/testsHelper';

test.describe('offset paginatedFragment', () => {
  test('loadNextPage', async ({ page }) => {
    await goto(page, routes.Pagination_fragment_offset);

    await expectToBe(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expect_1_gql(page, 'button[id=next]');

    // make sure we got the new content
    await expectToBe(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });
});
