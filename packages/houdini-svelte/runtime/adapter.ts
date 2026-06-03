// This file acts as the adapter for non-kit projects

export const isBrowser = true

/**
 *  After `clientStarted = true`, only client side navigation will happen.
 */
export let clientStarted = true // Will be true on a client side navigation

export const isPrerender = false

export const error = (_code: number, message: string) => message
export const redirect = (
	_status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308,
	_location: string
) => {}

export function setClientStarted() {
	clientStarted = true
}
