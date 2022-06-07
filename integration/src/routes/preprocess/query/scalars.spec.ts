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
    await page.goto(routes.Home);

    // We want the query in the frontend, so we navigate to the page
    // to zoom on scalar test & data
    let result = await expectGraphQLResponse(page, navSelector(routes.Preprocess_query_scalars));
    let json = JSON.parse(result ?? '');
    expect(json.data.user.birthDate).toBe(-466732800000);

    const divId = await page.locator('div[id=result-id]').textContent();
    expect(divId).toBe('Not a date!');

    const divDate = await page.locator('div[id=result-date]').textContent();
    expect(divDate).toBe('1955-03-19T00:00:00.000Z'); // ISO compare to not have timezone issues
  });
});
