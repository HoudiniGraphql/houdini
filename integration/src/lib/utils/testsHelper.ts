import { sleep, stry } from '@kitql/helper';
import type { Page, Response } from '@playwright/test';
import { expect, test } from '@playwright/test';
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
  } catch (error: unknown) {
    if (error instanceof Error) {
      expect(error.name).toBe('TimeoutError');
      nbError++;
    } else {
      // We should never come here!
      expect(0, 'a catch that was not an instanceof Error! It should NOT happen').toBe(1);
    }
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
  selector?: string | null,
  action: 'click' | 'hover' = 'click'
) {
  const listStr = await expectNGraphQLResponse(page, selector || null, 1, action);
  return listStr[0];
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
  // we are going to wait for n responses or 10seconds (whichever  comes first)

  // a promise that we'll resolve when we have all the responses
  let resolve: () => void = () => {};
  let resolved = false;
  const responsePromise = new Promise<void>((res) => {
    resolve = res;
  });

  // keep track of how many responses we've seen
  let nbResponse = 0;

  // and a stringified version of the response
  const listStr: string[] = [];

  let lock = false;

  let waitTime: number | null = null;
  let start = new Date().valueOf();

  // the function to call on each response
  async function fnRes(response: Response) {
    // if the response isn't for our API, don't count it
    if (!response.url().endsWith(routes.GraphQL)) {
      return;
    }
    if (waitTime === null) {
      waitTime = new Date().valueOf() - start;
    }

    while (lock) {
      await sleep(10);
    }

    lock = true;

    // increment the count
    nbResponse++;

    // if we're still waiting for a response, add the body to the list
    if (nbResponse <= n) {
      const json = await response.json();
      const str = stry(json, 0);
      listStr.push(str as string);
    }

    // if we got enough responses, resolve the promise
    if (nbResponse == n) {
      resolved = true;
      resolve();
    }

    lock = false;
  }

  // Listen
  page.on('response', fnRes);

  // Trigger the action
  if (selector) {
    if (action === 'click') {
      await page.click(selector);
    } else {
      await page.hover(selector);
    }
  }

  // wait for the first of 10 seconds or n responses
  await Promise.race([sleep(10000), responsePromise]);

  // if we have a wait time, then wait
  if (waitTime !== null) {
    await sleep(waitTime);

    // if we got an extra request, fail
    if (nbResponse > n) {
      throw new Error('Encountered too many responses');
    }
  }

  // Remove listeners
  // page.removeListener('request', fnReq);
  page.removeListener('response', fnRes);

  // if we didn't get enough responses, clean up and fail
  if (!resolved) {
    // make sure the promise isn't hanging around
    resolve();

    // we failed the test
    throw new Error('Timeout waiting for api requests');
  }

  // Sort and return!
  listStr.sort();

  return listStr;
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
  // If the selector is not found, we will get an error: Timeout.
  // It's usually because the page is not loading properly!
  expect(trimed ? result?.trim() : result, `element "${selector}" must BE 👇`).toBe(toBe);
}

/**
 * @param selector @default div[id=pageInfo]
 */
export async function expectToContain(page: Page, toBe: string, selector = 'div[id=pageInfo]') {
  const result = await page.locator(selector).textContent({ timeout: 2998 });
  expect(result, `element "${selector}" must CONTAIN 👇`).toContain(toBe);
}
