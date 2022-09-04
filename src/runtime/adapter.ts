// the actual contents of this file will get overwritten by the runtime generator
// this file just exists for type checking
import type { Page } from '@sveltejs/kit'
import type { Readable, Writable } from 'svelte/store'

export async function goTo(
	href: string,
	opts?: { replaceState?: boolean; noscroll?: boolean; keepfocus?: boolean; state?: any }
): Promise<void> {}

export const isBrowser = false

/**
 *  After `clientStarted = true`, only client side navigation will happen.
 */
export let clientStarted = false // Will be true on a client side navigation

export let isPrerender = false

export const error = (code: number, message: string) => message

export const isDev = true

export function setClientStarted() {
	clientStarted = true
}
