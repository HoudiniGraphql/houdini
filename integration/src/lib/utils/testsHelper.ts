import { stry } from '@kitql/helper';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { routes } from './routes.js';

export async function expectNoGraphQLRequest(page: Page) {
  let nbError = 0;
  let info;
  try {
    info = await page.waitForRequest(routes.GraphQL, { timeout: 777 }); // It's the request... It should be fairly fast. (Magic number to find it easily)
  } catch (error: any) {
    expect(error.name).toBe('TimeoutError');
    nbError++;
  }
  if (nbError === 0) {
    console.error(`The body of the query that shouldn't happen: `, info?.postDataJSON());
  }
  expect(
    nbError,
    'A GraphQL request happend, and it should NOT be the case! (We Expected 1 error)'
  ).toBe(1);
}

/**
 *
 * @param selector example: "button[id=next]"
 * @returns
 */
export async function expectGraphQLResponse(
  page: Page,
  selector: string | null,
  action: 'click' | 'hover' = 'click'
) {
  const [res] = await Promise.all([
    // Wait for the response
    page.waitForResponse(routes.GraphQL, { timeout: 1999 }),
    // Triggers the response
    selector ? (action === 'click' ? page.click(selector) : page.hover(selector)) : null
  ]);

  const json = await res.json();
  const str = stry(json, 0);
  expect(str).not.toBeNull();
  return str;
}

export function navSelector(route: string) {
  return `a[href="${route}"]`;
}

/**
 * Only routes that are in the nav menu,
 * if you want to check GraphQLResponse after, use `expectGraphQLResponse(page, navSelector(routes.XXX))`
 */
export async function clientSideNavigation(page: Page, route: string) {
  // Get the a link
  const linkToPage = page.locator(navSelector(route));
  // Trigger a client side navigation
  await linkToPage.click();
}
