import { expect, test } from '@playwright/test';
import {
  expectGraphQLResponse,
  expectNoGraphQLRequest,
  clientSideNavigation,
  navSelector
} from '../../../lib/utils/testsHelper.js';
import { routes } from '../../../lib/utils/routes.js';

test.describe('query preprocessor variables', () => {
  test('query values get unmarshaled into complex values', async function ({ page }) {
    await page.goto(routes.Preprocess_query_scalars);

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    const div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Fri Mar 18 1955 16:00:00 GMT-0800 (Pacific Daylight Time)');
  });
});
