// the actual contents of this file will get overwritten by the runtime generator
// this file just exists for type checking

import type { Page } from '@sveltejs/kit'

// the actual contents of this file gets overwritten by the runtime generator
export function getSession(): any | null {
	// @ts-ignore
	return {}
}

export function getPage(): Page {
	// @ts-ignore
	return {}
}

export async function goTo(
	href: string,
	opts?: { replaceState?: boolean; noscroll?: boolean; keepfocus?: boolean; state?: any }
): Promise<void> {}

export const isBrowser = false

/**
 *  After `clientStarted = true`, only client side navigation will happen.
 */
export let clientStarted = false // Will be true on a client side navigation
