import { expect, test } from '@playwright/test';
import { sleep } from '@kitql/helper';

let nbOfGraphQLRequest = -1;
let nbOfGraphQLResponse = -1;

test.beforeEach(async ({ page }) => {
  nbOfGraphQLRequest = 0;
  nbOfGraphQLResponse = 0;

  page.on('request', (request) => {
    // console.log('>>', request.method(), request.url());
    if (request.url().endsWith('graphql')) {
      nbOfGraphQLRequest++;
    }
  });
  page.on('response', (response) => {
    //console.log('<<', response.status(), response.url());
    if (response.url().endsWith('graphql')) {
      nbOfGraphQLResponse++;
    }
  });

  await page.goto('/stores/ssr');
});

test.describe('SSR Page', () => {
  test('We are on the right page', async ({ page }) => {
    expect(await page.textContent('h1')).toBe('SSR');
  });

  test('No GraphQL request & response happen (SSR)', async ({ page }) => {
    // Wait a bit... to be sure we don't have a client request comming
    await sleep(500);

    expect(nbOfGraphQLRequest, 'nbOfGraphQLRequest').toBe(0);
    expect(nbOfGraphQLResponse, 'nbOfGraphQLResponse').toBe(0);
  });

  test('Right Data in <li> elements (SSR)', async ({ page }) => {
    const li = page.locator('li');
    const count = await li.count();
    expect(count, 'number of <li> elements').toBe(2);

    const data = ['1 - Bruce Willis', '2 - Samuel Jackson'];
    for (let i = 0; i < count; ++i) {
      const text = await li.nth(i).textContent();
      expect(text?.trim(), 'Content of <li> element').toBe(data[i]);
    }
  });
});
