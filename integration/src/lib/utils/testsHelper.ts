import { routes } from './routes.js';
import { sleep, stry } from '@kitql/helper';
import type { Page, Response } from '@playwright/test';
import { expect } from '@playwright/test';

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
 * @returns
 */
export async function expectNoGraphQLResponse(
  page: Page,
  selector?: string | null,
  action: 'click' | 'hover' = 'click'
) {
  await expectNGraphQLResponse(page, selector || null, 0, action);
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
  const start = new Date().valueOf();
  const timing: number[] = [];

  // let nbRequest = 0;
  let nbResponse = 0;
  const listStr: string[] = [];

  // function fnReq(request: any) {
  //   // console.log('>>', request.method(), request.url());
  //   if (request.url().endsWith(routes.GraphQL)) {
  //     nbRequest++;
  //   }
  // }

  async function fnRes(response: Response) {
    // console.log('<<', response.status(), response.url());
    if (response.url().endsWith(routes.GraphQL)) {
      timing.push(new Date().valueOf() - start);
      try {
        const json = await response.json();
        const str = stry(json, 0);
        listStr.push(str as string);
        nbResponse++;
      } catch (error) {
        // not a json returned
        // it's ok as we speak about graphql here!
        // This was used:
        // await page.route('**/graphql', (route) => route.abort());
      }
    }
  }

  // Listen
  // page.on('request', fnReq);
  page.on('response', fnRes);

  // Trigger the action
  if (selector) {
    if (action === 'click') {
      await page.click(selector);
    } else {
      await page.hover(selector);
    }
  }

  // Wait algo
  if (n === 0) {
    // wait at least...
    await sleep(1111);
  } else {
    // default increment
    const tim_inc = 11;

    // total waiting time
    let time_waiting = 0;

    // did he waited enough?
    let waited_enough = false;

    // While
    // - n !== nbResponse => We don't have the right number of response
    // - time_waiting < 9999 => We don't reach the global timeout
    // - !waited_enough => We didn't wait enough
    while (n !== nbResponse && time_waiting < 9999 && !waited_enough) {
      // inc
      time_waiting += tim_inc;

      // if we have responses... Take the last one and double the number before saying, "OK we waited enough"
      if (timing.length > 0 && timing[timing.length - 1] * 2 < time_waiting) {
        waited_enough = true;
      }

      // Sleep a bit
      await sleep(tim_inc);
    }
  }

  // Remove listeners
  // page.removeListener('request', fnReq);
  page.removeListener('response', fnRes);

  // Check if numbers are ok
  // expect(nbRequest, 'nbRequest').toBe(n);
  expect(nbResponse, `Not the right number of responses (selector: ${selector})`).toBe(n);

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
 * Change the default of page.goto to wait for the page to be domcontentloaded!
 * By default goto expect NO graphql response, if you expect some, use: `goto_and_expectNGraphQLResponse`
 */
export async function goto(
  page: Page,
  url: string,
  waitUntil: 'domcontentloaded' | 'load' | 'networkidle' | 'commit' = 'domcontentloaded'
): Promise<null | Response> {
  const res = await page.goto(url, { waitUntil });
  await expectNGraphQLResponse(page, null, 0);
  return res;
}

export async function goto_and_expectNGraphQLResponse(
  page: Page,
  url: string,
  n: number
): Promise<string[]> {
  await page.goto(url, { waitUntil: 'load' });
  return expectNGraphQLResponse(page, null, n);
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
