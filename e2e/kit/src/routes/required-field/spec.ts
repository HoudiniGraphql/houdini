import { routes } from '../../lib/utils/routes.js';
import { expect_n_gql, expect_to_be, goto } from '../../lib/utils/testsHelper.js';
import { test } from '@playwright/test';

test.describe('required-field', () => {
  test('Get null and non-null required field', async ({ page }) => {
    await goto(page, routes.required_field);

    await expect_to_be(page, 'null', 'div[id="query-result"]');
    await expect_to_be(
      page,
      JSON.stringify(
        {
          withRequired: null,
          withoutRequired: null
        },
        null,
        2
      ),
      'div[id="fragment-result"]'
    );

    // we click on the button to get a user with non-null birthdate
    await expect_n_gql(page, 'button[id="getNonNull"]', 2);
    await expect_to_be(
      page,
      JSON.stringify(
        {
          withRequired: {
            id: 'user-required:1',
            name: 'Bruce Willis',
            birthDate: '1955-03-19T00:00:00.000Z'
          },
          withoutRequired: {
            id: 'user-required:1',
            name: 'Bruce Willis',
            birthDate: '1955-03-19T00:00:00.000Z'
          }
        },
        null,
        2
      ),
      'div[id="query-result"]'
    );
    await expect_to_be(
      page,
      JSON.stringify(
        {
          withRequired: {
            name: 'Bruce Willis',
            birthDate: '1955-03-19T00:00:00.000Z',
            id: 'user-required:1',
            __typename: 'User'
          },
          withoutRequired: {
            name: 'Bruce Willis',
            birthDate: '1955-03-19T00:00:00.000Z',
            id: 'user-required:1',
            __typename: 'User'
          }
        },
        null,
        2
      ),
      'div[id="fragment-result"]'
    );

    // we click on the button to get a user with null birthdate
    await expect_n_gql(page, 'button[id="getNull"]', 2);
    await expect_to_be(
      page,
      JSON.stringify(
        {
          withRequired: null,
          withoutRequired: {
            id: 'user-required:2',
            name: 'Samuel Jackson',
            birthDate: null
          }
        },
        null,
        2
      ),
      'div[id="query-result"]'
    );
    await expect_to_be(
      page,
      JSON.stringify(
        {
          withRequired: null,
          withoutRequired: {
            name: 'Samuel Jackson',
            birthDate: null,
            id: 'user-required:2',
            __typename: 'User'
          }
        },
        null,
        2
      ),
      'div[id="fragment-result"]'
    );
  });
});
