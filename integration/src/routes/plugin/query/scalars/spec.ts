import { routes } from '../../../../lib/utils/routes.js';
import { expect_1_gql, expectToBe, goto, navSelector } from '../../../../lib/utils/testsHelper.js';
import { expect, test } from '@playwright/test';

test.describe('query preprocessor variables', () => {
  test('query values get unmarshaled into complex values', async function ({ page }) {
    await goto(page, routes.Home);

    // We want the query in the frontend, so we navigate to the page
    // to zoom on scalar test & data
    const result = await expect_1_gql(page, navSelector(routes.Plugin_query_scalars));
    const json = JSON.parse(result ?? '');
    expect(json.data.user.birthDate).toBe(-466732800000);

    // ISO compare to not have timezone issues
    await expectToBe(page, '1955-03-19T00:00:00.000Z', 'div[id=result-date]');
  });
});
