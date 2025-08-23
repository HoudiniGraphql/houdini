import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import {
  expect_to_be,
  expectToContain,
  expect_1_gql,
  goto
} from '../../../../lib/utils/testsHelper.js';

test.describe('bidirectional cursor single page paginated query', () => {
  test('backwards and then forwards', async ({ page }) => {
    await goto(page, routes.Pagination_query_bidirectional_cursor_single_page);

    await expect_to_be(page, 'Morgan Freeman, Tom Hanks');

    /// Click on the previous button

    // load the previous page and wait for the response
    await expect_1_gql(page, 'button[id=previous]');

    // make sure we got the new content
    await expect_to_be(page, 'Bruce Willis, Samuel Jackson');

    // there should be a next page
    await expectToContain(page, `"hasNextPage":true`);
    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":false`);

    /// Click on the next button

    // load the next page and wait for the response
    await expect_1_gql(page, 'button[id=next]');

    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":true`);
    // there should be a next page
    await expectToContain(page, `"hasNextPage":true`);

    // make sure we got the new content
    await expect_to_be(page, 'Morgan Freeman, Tom Hanks');

    /// Click on the next button

    // load the next page and wait for the response
    await expect_1_gql(page, 'button[id=next]');

    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":true`);
    // there should be a next page
    await expectToContain(page, `"hasNextPage":true`);

    // make sure we got the new content
    await expect_to_be(page, 'Will Smith, Harrison Ford');

    /// Click on the next button

    // load the next page and wait for the response
    await expect_1_gql(page, 'button[id=next]');

    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":true`);
    // there should be a next page
    await expectToContain(page, `"hasNextPage":false`);

    // make sure we got the new content
    await expect_to_be(page, 'Eddie Murphy, Clint Eastwood');
  });

  test('forwards then backwards and then forwards again', async ({ page }) => {
    await goto(page, routes.Pagination_query_bidirectional_cursor_single_page);

    await expect_to_be(page, 'Morgan Freeman, Tom Hanks');

    /// Click on the next button

    // load the next page and wait for the response
    await expect_1_gql(page, 'button[id=next]');

    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":true`);
    // there should be a next page
    await expectToContain(page, `"hasNextPage":true`);

    // make sure we got the new content
    await expect_to_be(page, 'Will Smith, Harrison Ford');

    /// Click on the previous button

    // load the previous page and wait for the response
    await expect_1_gql(page, 'button[id=previous]');

    // make sure we got the new content
    await expect_to_be(page, 'Morgan Freeman, Tom Hanks');

    // there should be a next page
    await expectToContain(page, `"hasNextPage":true`);
    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":true`);

    /// Click on the previous button

    // load the previous page and wait for the response
    await expect_1_gql(page, 'button[id=previous]');

    // make sure we got the new content
    await expect_to_be(page, 'Bruce Willis, Samuel Jackson');

    // there should be a next page
    await expectToContain(page, `"hasNextPage":true`);
    // there should be no previous page
    await expectToContain(page, `"hasPreviousPage":false`);
  });
});
