import { sleep, stry } from '@kitql/helper';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { routes } from './routes.js';

export async function expectNoGraphQLRequest(
  page: Page,
  selector: string | null = null,
  action: 'click' | 'hover' = 'click'
) {
  let nbError = 0;
  let info;
  try {
    const [res] = await Promise.all([
      page.waitForRequest(routes.GraphQL, { timeout: 777 }), // It's the request... It should be fairly fast. (Magic number to find it easily)
      selector ? (action === 'click' ? page.click(selector) : page.hover(selector)) : null
    ]);
    info = res;
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

/**
 *
 * @param selector example: "button[id=next]"
 * @returns The list of response. We will sort results by Alphabetical order (because we can't do any thing else :))
 */
export async function expectNGraphQLResponse(
  page: Page,
  selector: string | null,
  n: number,
  action: 'click' | 'hover' = 'click'
) {
  let nbRequest = 0;
  let nbResponse = 0;
  const listStr: string[] = [];

  function fnReq(request: any) {
    // console.log('>>', request.method(), request.url());
    nbRequest++;
  }

  async function fnRes(response: any) {
    // console.log('<<', response.status(), response.url());
    nbResponse++;
    const json = await response.json();
    const str = stry(json, 0);
    listStr.push(str as string);
  }

  // Listen
  page.on('request', fnReq);
  page.on('response', fnRes);

  // Trigger the action
  selector ? (action === 'click' ? page.click(selector) : page.hover(selector)) : null;

  // Wait a bit...
  await sleep(2111);

  // Remoe listeners
  page.removeListener('request', fnReq);
  page.removeListener('response', fnRes);

  // Check if numbers are ok
  expect(nbRequest, 'nbRequest').toBe(n);
  expect(nbResponse, 'nbResponse').toBe(n);

  // Sort and return!
  return listStr.sort();
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

/**
 * @param selector @default div[id=result]
 */
export async function expectToBe(
  page: Page,
  toBe: string,
  selector = 'div[id=result]',
  trimed = true
) {
  const result = await page.locator(selector).textContent({ timeout: 2997 });
  expect(trimed ? result?.trim() : result, `element "${selector}" must BE 👇`).toBe(toBe);
}

/**
 * @param selector @default div[id=pageInfo]
 */
export async function expectToContain(page: Page, toBe: string, selector = 'div[id=pageInfo]') {
  const result = await page.locator(selector).textContent({ timeout: 2998 });
  expect(result, `element "${selector}" must CONTAIN 👇`).toContain(toBe);
}
