import { stry } from '@kitql/helper';
import { expect } from '@playwright/test';
import { routes } from './routes.ts';

export async function expectNoGraphQLRequest(page: any) {
  let nbError = 0;
  try {
    await page.waitForRequest(routes.GraphQL, { timeout: 777 }); // It's the request... It should be fairly fast. (Magic number to find it easily)
  } catch (error: any) {
    expect(error.name).toBe('TimeoutError');
    nbError++;
  }
  expect(nbError, 'number of expected error, so a GraphQL request happend!').toBe(1);
}

export async function expectGraphQLResponse(page: any) {
  const res = await page.waitForResponse(routes.GraphQL, { timeout: 1999 }); // It's the response... It can take a bit of time in the CI... (Magic number to find it easily)
  const json = await res.json();
  const str = stry(json, 0);
  expect(str).not.toBeNull();
  return str;
}

/**
 * Only routes that are in the nav menu
 */
export async function clientSideNavigation(page: any, route: string) {
  // Get the a link
  const linkToPage = page.locator(`a[href="${route}"]`);
  // Trigger a client side navigation
  await linkToPage.click();
}
