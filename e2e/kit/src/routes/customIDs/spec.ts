import { expect, test } from '@playwright/test';
import { routes } from '../../lib/utils/routes.js';
import { expect_1_gql, expect_to_be, goto } from '../../lib/utils/testsHelper.js';

test.describe('customIDs', () => {
  test('Mutation should update the cache', async ({ page }) => {
    await goto(page, routes.customIDs);

    // expect to have the righ data
    await expect_to_be(
      page,
      'User: 1 - Book: 0 - Rate: 10 User: 5 - Book: 5 - Rate: 8 User: 1 - Book: 1 - Rate: 9'
    );

    const ret = await expect_1_gql(page, 'button[id=u77]');

    // graphql result (with the customIds added & the rate to 77)
    expect(ret).toBe(`{"data":{"updateRentedBook":{"bookId":1,"rate":77,"userId":"1"}}}`);

    // displayed result with the updated value to 77
    await expect_to_be(
      page,
      'User: 1 - Book: 0 - Rate: 10 User: 5 - Book: 5 - Rate: 8 User: 1 - Book: 1 - Rate: 77'
    );
  });
});
