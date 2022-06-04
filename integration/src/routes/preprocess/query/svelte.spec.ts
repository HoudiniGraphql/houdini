import { expect, test } from '@playwright/test';
import { expectGraphQLResponse } from '../../../lib/utils/testsHelper.ts';

test.describe('query preprocessor', () => {
  test('happy path query', async ({ page }) => {
    await page.goto('/preprocess/query/simple');

    const result = await expectGraphQLResponse(page);

    await expect(result).resolves.toMatchSnapshot();
  });
});
