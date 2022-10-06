import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import { expectToBe, goto } from '../../../../lib/utils/testsHelper';

test.describe('query preprocessor', () => {
  test('multiple queries', async ({ page }) => {
    await goto(page, routes.Plugin_query_multiple);

    await expectToBe(page, 'Bruce Willis', 'div[id=result1]');

    await expectToBe(page, 'Samuel Jackson', 'div[id=result2]');
  });
});
