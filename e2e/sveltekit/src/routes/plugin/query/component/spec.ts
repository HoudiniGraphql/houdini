import { test } from '@playwright/test';
import { routes } from '../../../../lib/utils/routes';
import { expectToBe, goto_expect_n_gql } from '../../../../lib/utils/testsHelper';

test.describe('query preprocessor', () => {
  test('component queries', async ({ page }) => {
    await goto_expect_n_gql(page, routes.Plugin_query_component, 2);

    await expectToBe(page, 'Morgan Freeman', 'div[id=result-default]');
    await expectToBe(page, 'Samuel Jackson', 'div[id=result-prop]');
  });
});
