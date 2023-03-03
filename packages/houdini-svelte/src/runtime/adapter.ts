// This file acts as the adapter for non-kit projects

export const isBrowser = true

/**
 *  After `clientStarted = true`, only client side navigation will happen.
 */
export let clientStarted = true // Will be true on a client side navigation

export let isPrerender = false

export const error = (code: number, message: string) => message
export const redirect = (
	status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308,
	location: string
) => {}

export function setClientStarted() {
	clientStarted = true
}
