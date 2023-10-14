import type { Page, Response } from '@playwright/test'
import { expect } from '@playwright/test'

import { routes } from './routes.js'

async function sleep(ms: number) {
	if (ms <= 0) {
		return
	}
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 *
 * @param selector example: "button[id=next]"
 * @returns
 */
export async function expect_0_gql(
	page: Page,
	selector?: string | null,
	action: 'click' | 'hover' = 'click'
) {
	await expect_n_gql(page, selector || null, 0, action)
}

/**
 *
 * @param selector example: "button[id=next]"
 * @returns
 */
export async function expect_1_gql(
	page: Page,
	selector?: string | null,
	action: 'click' | 'hover' = 'click'
) {
	const listStr = await expect_n_gql(page, selector || null, 1, action)
	return listStr[0]
}

/**
 *
 * @param selector example: "button[id=next]"
 * @returns The list of response. We will sort results by Alphabetical order (because we can't do any thing else :))
 */
export async function expect_n_gql(
	page: Page,
	selector: string | null,
	n: number,
	action: 'click' | 'hover' | 'press_ArrowUp' | 'press_ArrowDown' = 'click'
) {
	const start = new Date().valueOf()
	const timing: number[] = []

	// let nbRequest = 0;
	let nbResponse = 0
	const listStr: string[] = []

	// function fnReq(request: any) {
	//   // console.log('>>', request.method(), request.url());
	//   if (request.url().endsWith(routes.GraphQL)) {
	//     nbRequest++;
	//   }
	// }

	async function fnRes(response: Response) {
		// console.log('<<', response.status(), response.url());
		if (response.url().endsWith(routes.GraphQL)) {
			timing.push(new Date().valueOf() - start)
			try {
				const json = await response.json()
				const str = JSON.stringify(json, null, 0)
				listStr.push(str as string)
				nbResponse++
			} catch (error) {
				// not a json returned
				// it's ok as we speak about graphql here!
				// This was used:
				// await page.route('**/graphql', (route) => route.abort());
			}
		}
	}

	// Listen
	page.on('response', fnRes)

	// Trigger the action
	if (selector) {
		if (action === 'click') {
			await page.click(selector)
		} else if (action === 'hover') {
			await page.hover(selector)
		} else if (action === 'press_ArrowUp') {
			await page.locator(selector).press('ArrowUp')
		} else if (action === 'press_ArrowDown') {
			page.locator(selector).press('ArrowDown')
		} else {
			throw new Error(`action ${action} not implemented`)
		}
	}

	// default waiting time
	let time_waiting = 1111

	// Wait algo
	if (n === 0) {
		// wait at least...
		await sleep(time_waiting)
	} else {
		// default increment
		const tim_inc = 11

		// did he waited enough?
		let waited_enough = false

		// reset and start from 0 to start the loop.
		time_waiting = 0

		// While
		// - n !== nbResponse => We don't have the right number of response
		// - time_waiting < 9999 => We don't reach the global timeout
		// - !waited_enough => We didn't wait enough
		while (n !== nbResponse && time_waiting < 9999 && !waited_enough) {
			// inc
			time_waiting += tim_inc

			// if we have responses... Take the last one and double the number before saying, "OK we waited enough"
			if (timing.length > 0 && timing[timing.length - 1] * 2 < time_waiting) {
				waited_enough = true
			}

			// Sleep a bit
			await sleep(tim_inc)
		}
	}

	// Remove listeners
	// page.removeListener('request', fnReq);
	page.removeListener('response', fnRes)

	// Check if numbers are ok
	// expect(nbRequest, 'nbRequest').toBe(n);
	expect(
		nbResponse,
		`Not the right number of responses (selector: ${selector}, Waited ${time_waiting}ms.)`
	).toBe(n)

	// Sort and return!
	return listStr.sort()
}

export function navSelector(route: string) {
	return `a[href="${route}"]`
}

/**
 * Only routes that are in the nav menu,
 * if you want to check GraphQLResponse after, use `expectGraphQLResponse(page, navSelector(routes.XXX))`
 */
export async function clientSideNavigation(page: Page, route: string) {
	await locator_click(page, navSelector(route))
}

export async function locator_click(page: Page, selector: string) {
	const locator = page.locator(selector)
	// Trigger a client side navigation
	await locator.click()
	// wait for the navigation to happen
	await sleep(111)
}

/**
 * Change the default of page.goto to wait for the page to be domcontentloaded!
 * By default goto expect NO graphql response, if you expect some, use: `goto_expect_n_gql`
 * @returns The response of the page
 */
export async function goto(
	page: Page,
	url: string,
	waitUntil: 'domcontentloaded' | 'load' | 'networkidle' | 'commit' = 'domcontentloaded'
): Promise<null | Response> {
	const res = await page.goto(url, { waitUntil })
	await expect_n_gql(page, null, 0)
	return res
}

/**
 * @returns The response of graphql queries
 */
export async function goto_expect_n_gql(page: Page, url: string, n: number): Promise<string[]> {
	const [, resExpect] = await Promise.all([
		page.goto(url, { waitUntil: 'load' }),
		expect_n_gql(page, null, n),
	])
	return resExpect
}

/**
 * @param selector @default div[id=result]
 */
export async function expect_to_be(
	page: Page,
	toBe: string,
	selector = 'div[id=result]',
	trimed = true
) {
	const result = await page.locator(selector).textContent({ timeout: 2997 })
	// If the selector is not found, we will get an error: Timeout.
	// It's usually because the page is not loading properly!
	expect(trimed ? result?.trim() : result, `element "${selector}" must BE 👇`).toBe(toBe)
}

/**
 * @param selector @default div[id=pageInfo]
 */
export async function expectToContain(page: Page, toBe: string, selector = 'div[id=pageInfo]') {
	const result = await page.locator(selector).textContent({ timeout: 2998 })
	expect(result, `element "${selector}" must CONTAIN 👇`).toContain(toBe)
}

export async function waitForConsole(page: Page, type: 'info' | 'error' | 'warning' = 'info') {
	return await page.waitForEvent('console', {
		predicate: (msg) => {
			// console.log(`msg.type()`, msg)
			return msg.type() === type
		},
		timeout: 4444,
	})
}
