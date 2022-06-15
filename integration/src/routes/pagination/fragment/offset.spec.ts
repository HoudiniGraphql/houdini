import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  expectToBe
} from '../../../lib/utils/testsHelper.js';

test.describe('offset paginatedFragment', () => {
  test('loadNextPage', async ({ page }) => {
    await page.goto(routes.Pagination_fragment_offset);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    await expectToBe(page, 'Bruce Willis, Samuel Jackson');

    // wait for the api response
    await expectGraphQLResponse(page, 'button[id=next]');

    // make sure we got the new content
    await expectToBe(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });
});
