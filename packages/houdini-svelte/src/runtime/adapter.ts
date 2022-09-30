// the actual contents of this file will get overwritten by the runtime generator
// this file just exists for type checking
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

export function setClientStarted() {
	clientStarted = true
}
