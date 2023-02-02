import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_to_be, expect_1_gql, goto } from '../../lib/utils/testsHelper.js';

test.describe('union-result', () => {
  test('Get two stores and not resetting', async ({ page }) => {
    await goto(page, routes.union_result);

    // When we arrive on the page, we expect to see null in the result div
    await expect_to_be(page, 'null');

    // we click on the button to getAllUsers
    await expect_1_gql(page, 'button[id="getAllUsers"]');

    const data = {
      userNodesResult: {
        totalCount: 8,
        nodes: [
          {
            id: 'union-result:1',
            name: 'Bruce Willis'
          },
          {
            id: 'union-result:2',
            name: 'Samuel Jackson'
          },
          {
            id: 'union-result:3',
            name: 'Morgan Freeman'
          },
          {
            id: 'union-result:4',
            name: 'Tom Hanks'
          },
          {
            id: 'union-result:5',
            name: 'Will Smith'
          },
          {
            id: 'union-result:6',
            name: 'Harrison Ford'
          },
          {
            id: 'union-result:7',
            name: 'Eddie Murphy'
          },
          {
            id: 'union-result:8',
            name: 'Clint Eastwood'
          }
        ],
        __typename: 'UserNodes'
      }
    };

    // expect data (of AllUsers) to be displayed
    await expect_to_be(page, JSON.stringify(data, null, 2));

    // we click on the button to getAllUsers
    const res = await expect_1_gql(page, 'button[id="getUser"]');

    // expect data (of User) to be returned
    expect(res).toBe(
      `{"data":{"userResult":{"__typename":"User","id":"union-result:1","name":"Bruce Willis"}}}`
    );

    // expect data (of AllUsers) to still be here and displayed
    await expect_to_be(page, JSON.stringify(data, null, 2));
  });
});
