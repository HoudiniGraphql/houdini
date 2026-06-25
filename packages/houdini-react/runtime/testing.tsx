// @refresh reset
import { getCurrentConfig } from '$houdini/runtime/config'
import { Cache } from 'houdini/runtime/cache'
import { DataSource } from 'houdini/runtime/types'
import { HoudiniClient } from '$houdini/runtime/client'
import React from 'react'

import { scalarMarshalers, serializeSearch } from './resolve-href.js'
import { Router as RouterImpl, RouterContextProvider, router_cache } from './routing/index.js'
import manifest from './manifest.js'

type MockValue =
	| Record<string, unknown>
	| ((vars: any) => Record<string, unknown>)
	| AsyncIterable<Record<string, unknown>>
	| ((vars: any) => AsyncIterable<Record<string, unknown>>)

// buildMockPath turns a route pattern, its params, and an optional search object into
// the concrete path a test wants to render. The typed createMock wrapper calls this so
// that param substitution (and its missing-param error) and search serialization both
// happen before the path reaches _createMock.
export function buildMockPath(
	pattern: string,
	params: Record<string, string>,
	search?: Record<string, unknown>
): string {
	if (!search) {
		return buildURL(pattern, params)
	}
	// marshal custom-scalar search values the same way <Link> does, so tests exercise
	// the real serialization path
	const m = manifest as any
	const page = m.pages[m.pagesByUrl[pattern]] as
		| { searchParams?: ReadonlyArray<{ name: string; type: string }> }
		| undefined
	const marshalers = scalarMarshalers(page?.searchParams, getCurrentConfig()?.scalars)
	return buildURL(pattern, params) + serializeSearch(search, marshalers)
}

export function _createMock({
	path,
	data: mocks,
}: {
	path: string
	data: Record<string, MockValue>
}): React.ComponentType<{}> {
	// the route patterns are anchored to the path, so strip any search string
	// before matching
	const pathname = path.split('?')[0]

	// Validate required mocks up-front at the call site so the error points
	// directly to the createMock() call rather than surfacing during rendering.
	const pages = manifest.pages as Record<
		string,
		{ pattern: RegExp; documents: Record<string, unknown> }
	>
	const page = Object.values(pages).find((p) => p.pattern.test(pathname))
	if (page) {
		const missing = Object.keys(page.documents).filter((name) => !(name in mocks))
		if (missing.length > 0) {
			throw new Error(
				`createMock: missing mock data for ${missing.map((n) => `"${n}"`).join(', ')} on route "${pathname}". Add ${missing.length === 1 ? 'it' : 'them'} to the data object passed to createMock.`
			)
		}
	}

	const cache = new Cache(getCurrentConfig())

	const mockPlugin = () => ({
		network(ctx: any, { resolve }: any) {
			const mock = mocks[ctx.artifact.name]
			if (mock === undefined) {
				throw new Error(
					`createMock: "${ctx.artifact.name}" fired but was not in data. Add it to the data object passed to createMock.`
				)
			}

			if (ctx.artifact.kind === 'HoudiniSubscription') {
				const iterable =
					typeof mock === 'function'
						? (mock as (v: any) => AsyncIterable<Record<string, unknown>>)(
								ctx.variables ?? {}
							)
						: (mock as AsyncIterable<Record<string, unknown>>)
				const iterator = iterable[Symbol.asyncIterator]()
				ctx.abortController.signal.addEventListener(
					'abort',
					() => {
						iterator.return?.()
					},
					{ once: true }
				)
				;(async () => {
					for await (const data of { [Symbol.asyncIterator]: () => iterator }) {
						if (ctx.abortController.signal.aborted) break
						resolve(ctx, {
							data,
							errors: null,
							fetching: false,
							variables: null,
							source: DataSource.Network,
							partial: false,
							stale: false,
						})
					}
				})()
				return
			}

			const data = typeof mock === 'function' ? mock(ctx.variables ?? {}) : mock
			resolve(ctx, {
				data,
				errors: null,
				fetching: false,
				variables: null,
				source: DataSource.Network,
				partial: false,
				stale: false,
			})
		},
	})

	// Pass the same fresh cache to the client so the cache policy plugin doesn't
	// reach into the global cacheRef singleton and return stale data from previous tests.
	// the mockPlugin intercepts the network, so no url is needed (and the client no longer takes one)
	const mockClient = new HoudiniClient({
		plugins: [mockPlugin as any],
		cache,
	})

	return function MockApp() {
		const cachesRef = React.useRef<ReturnType<typeof router_cache> | null>(null)
		if (cachesRef.current === null) {
			cachesRef.current = router_cache()
		}
		const caches = cachesRef.current
		return (
			<RouterContextProvider
				client={mockClient}
				cache={cache}
				artifact_cache={caches.artifact_cache}
				component_cache={caches.component_cache}
				data_cache={caches.data_cache}
				ssr_signals={caches.ssr_signals}
				last_variables={caches.last_variables}
			>
				<React.Suspense fallback={null}>
					<RouterImpl manifest={manifest} initialURL={path} assetPrefix="" />
				</React.Suspense>
			</RouterContextProvider>
		)
	}
}

function buildURL(pattern: string, params: Record<string, string>): string {
	return pattern.replace(/\[([^\]]+)\]/g, (_, key) => {
		const value = params[key]
		if (value === undefined) {
			throw new Error(`createMock: missing param "${key}" for pattern "${pattern}"`)
		}
		return String(value)
	})
}
