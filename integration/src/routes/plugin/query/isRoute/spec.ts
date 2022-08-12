import { routes } from '../../../../lib/utils/routes.js';
import { expectNGraphQLResponse, expectToBe } from '../../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('query preprocessor', () => {
  test('component queries', async ({ page }) => {
    await page.goto(routes.Plugin_query_isRoute);

    // two different queries should have fired
    await expectNGraphQLResponse(page, null, 2);

    await expectToBe(page, 'Morgan Freeman', 'div[id=result-default]');
    await expectToBe(page, 'Samuel Jackson', 'div[id=result-prop]');
  });
});
