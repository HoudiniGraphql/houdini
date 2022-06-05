import { expect, test } from '@playwright/test';
import { expectGraphQLResponse, expectNoGraphQLRequest } from '../../../lib/utils/testsHelper.ts';

test.describe('pagination', () => {
  test('forward cursor', async ({ page }) => {
    await page.goto('/pagination/fragment/forward-cursor');

    // We should have the data without a GraphQL request in the client
    await expectNoGraphQLRequest(page);

    let div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis, Samuel Jackson');

    // load the next page
    await page.locator('button[id=next]').click();

    // wait for the api response
    await expectGraphQLResponse(page);

    // make sure we got the new content
    div = await page.locator('div[id=result]').textContent();
    expect(div).toBe('Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks');
  });

  test('forward cursor refetch', async ({ page }) => {
    await page.goto('/pagination/fragment/forward-cursor');

    // load the next page
    await page.locator('button[id=next]').click();

    // wait for the api response
    await expectGraphQLResponse(page);

    // click on the refetch button
    await page.locator('button[id=refetch]').click();

    // wait for the api response
    const response = await expectGraphQLResponse(page);

    expect(response).toMatchSnapshot();
  });

  test('page info tracks connection state', async ({ page }) => {
    await page.goto('/pagination/fragment/forward-cursor');

    // load the next 4 pages
    for (let i = 0; i < 4; i++) {
      // click the button
      await page.locator('button[id=next]').click();
      // wait for the request to resolve
      await expectGraphQLResponse(page);
      // check the page info
      const content = await page.locator('div[id=result]').textContent();
      expect(content).resolves.toMatchSnapshot();
    }

    // make sure we have all of the data loaded
    const content = await page.locator('div[id=result]').textContent();
    expect(content).resolves.toMatchSnapshot();
  });
});
