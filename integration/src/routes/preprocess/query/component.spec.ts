import { test } from '@playwright/test';
import { routes } from '../../../lib/utils/routes.js';
import { expectGraphQLResponse, expectToBe } from '../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('component queries', async ({ page }) => {
    await page.goto(routes.Preprocess_query_component);

    // two different queries should have fired
    await expectGraphQLResponse(page, null);

    await expectToBe(page, 'Morgan Freeman', 'div[id=result-default]');
    await expectToBe(page, 'Samuel Jackson', 'div[id=result-prop]');
  });
});
