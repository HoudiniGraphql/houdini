import { routes } from '../../../lib/utils/routes.js';
import { expect_1_gql, goto, expectToBe } from '../../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('mutation store upload', function () {
  test('single files', async function ({ page }) {
    await goto(page, routes.Stores_Mutation_Scalar_Single_Upload);

    // trigger the mutation and wait for a response
    await expect_1_gql(page, 'button[id=mutate]');

    // make sure that the return data is equal file content ("Houdini")
    await expectToBe(page, '{"singleUpload":"Houdini"}');
  });
});
