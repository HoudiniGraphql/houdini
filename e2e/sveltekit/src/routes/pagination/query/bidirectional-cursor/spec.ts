import { expect, test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_1_gql,
  expect_0_gql,
  expectToBe,
  expectToContain,
  goto
} from '../../../../lib/utils/testsHelper.js';

test.describe('bidirectional cursor paginated query', () => {
  test('backwards and then forwards', async ({ page }) => {
    await goto(page, routes.Pagination_query_bidirectional_cursor);

    await expectToBe(page, 'Morgan Freeman, Tom Hanks');

    /// Click on the previous button

    // load the previous page and wait for the response
    await expect_1_gql(page, 'button[id=previous]');

    // make sure we got the new content
    await expectToBe(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');

    // there should be a next page
    await expectToContain(page, `"hasNextPage":true`);
    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":false`);

    /// Click on the next button

    // load the next page and wait for the response
    await expect_1_gql(page, 'button[id=next]');

    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":false`);
    // there should be a next page
    await expectToContain(page, `"hasNextPage":true`);

    // make sure we got the new content
    await expectToBe(
      page,
      'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford'
    );
  });
});
