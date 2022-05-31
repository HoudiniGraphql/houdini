import { stry } from '@kitql/helper';
import { expect } from '@playwright/test';
import { routes } from './routes.js';

export async function expectNoGraphQLRequest(page) {
  let nbError = 0;
  try {
    await page.waitForRequest(routes.GraphQL, { timeout: 500 });
  } catch (error) {
    expect(error.name).toBe('TimeoutError');
    nbError++;
  }
  expect(nbError, 'number of expected error, so a GraphQL request happend!').toBe(1);
}

export async function expectGraphQLResponse(page) {
  const res = await page.waitForResponse(routes.GraphQL, { timeout: 500 });
  const json = await res.json();
  const str = stry(json, 0);
  expect(str).not.toBeNull();
  return str;
}

export async function clientSideNavigation(page, route) {
  // Get the a link
  const linkToPage = page.locator(`a[href="${route}"]`);
  // Trigger a client side navigation
  await linkToPage.click();
}
