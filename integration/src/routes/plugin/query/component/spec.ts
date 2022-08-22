import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes.js';
import { expectToBe, goto_and_expectNGraphQLResponse } from '../../../../lib/utils/testsHelper.js';

test.describe('query preprocessor', () => {
  test('component queries', async ({ page }) => {
    await goto_and_expectNGraphQLResponse(page, routes.Plugin_query_component, 2);

    await expectToBe(page, 'Morgan Freeman', 'div[id=result-default]');
    await expectToBe(page, 'Samuel Jackson', 'div[id=result-prop]');
  });
});
