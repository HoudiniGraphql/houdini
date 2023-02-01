import { goto, invalidate } from '$app/navigation'
import type { Page } from '@sveltejs/kit'
import { get, writable, type Readable } from 'svelte/store'

/**
 * Query String Link
 */
export const QSLink = (page: Readable<Page<Record<string, string>>>, name: string) => {
	const { subscribe, set } = writable<string | null>(null)

	const pageStore = get(page)

	set(pageStore.url.searchParams.get(name))

	return {
		subscribe,
		set: async (value) => {
			if (value === null || value === '') {
				pageStore.url.searchParams.delete(name)
			} else {
				pageStore.url.searchParams.set(name, value)
			}
			const url = pageStore.url.href
			// 1/ goto
			// 2/ invalidate
			// 3/ set the value
			await goto(url, { replaceState: true, keepFocus: true })
			await invalidate(url)
			set(value)
		}
	}
}
