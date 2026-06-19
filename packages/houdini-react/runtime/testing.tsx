// @refresh reset
import { getCurrentConfig } from '$houdini/runtime/config'
import { Cache } from 'houdini/runtime/cache'
import { DataSource } from 'houdini/runtime/types'
import { HoudiniClient } from '$houdini/runtime/client'
import React from 'react'

import { Router as RouterImpl, RouterContextProvider, router_cache } from './routing/index.js'
import manifest from './manifest.js'

type MockValue = Record<string, unknown> | ((vars: any) => Record<string, unknown>)

export function _createMock({
	url: routePattern,
	params,
	data: mocks,
}: {
	url: string
	params: Record<string, string>
	data: Record<string, MockValue>
}): React.ComponentType<{}> {
	const url = buildURL(routePattern, params)

	// Validate required mocks up-front at the call site so the error points
	// directly to the createMock() call rather than surfacing during rendering.
	const pages = manifest.pages as Record<
		string,
		{ pattern: RegExp; documents: Record<string, unknown> }
	>
	const page = Object.values(pages).find((p) => p.pattern.test(url))
	if (page) {
		const missing = Object.keys(page.documents).filter((name) => !(name in mocks))
		if (missing.length > 0) {
			throw new Error(
				`createMock: missing mock data for ${missing.map((n) => `"${n}"`).join(', ')} on route "${routePattern}". Add ${missing.length === 1 ? 'it' : 'them'} to the data object passed to createMock.`
			)
		}
	}

	const cache = new Cache(getCurrentConfig())

	const mockPlugin = () => ({
		network(ctx: any, { resolve }: any) {
			if (ctx.artifact.kind === 'HoudiniSubscription') {
				throw new Error(
					`createMock: subscriptions are not supported. "${ctx.artifact.name}" fired during this test.`
				)
			}
			const mock = mocks[ctx.artifact.name]
			if (mock === undefined) {
				throw new Error(
					`createMock: "${ctx.artifact.name}" fired but was not in data. Add it to the data object passed to createMock.`
				)
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
	const mockClient = new HoudiniClient({
		url: 'http://localhost/graphql',
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
				<RouterImpl manifest={manifest} initialURL={url} assetPrefix="" />
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
