import type { ConfigFile } from 'houdini'
import type { ClientPlugin } from 'houdini/runtime/client'
import type { DocumentArtifact } from 'houdini/runtime'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { HoudiniDevtools } from './HoudiniDevtools'
import styles from './styles.css?inline'
import { addRequestEvent, createRequest, failRequest, succeedRequest } from './store'
import type { RequestKind } from './type'

let root: Root | null = null
let container: HTMLDivElement | null = null
let mountQueued = false

function mountOverlay() {
	if (typeof document === 'undefined') {
		return
	}

	if (root && container?.isConnected) {
		return
	}

	container = document.createElement('div')
	container.id = 'houdini-devtools-overlay'
	document.body.appendChild(container)

	const shadowRoot = container.attachShadow({ mode: 'open' })
	const style = document.createElement('style')
	style.textContent = styles
	shadowRoot.appendChild(style)

	const mountPoint = document.createElement('div')
	shadowRoot.appendChild(mountPoint)

	root = createRoot(mountPoint)
	root.render(React.createElement(HoudiniDevtools))
}

function scheduleMountOverlay() {
	if (typeof window === 'undefined' || mountQueued) {
		return
	}

	mountQueued = true

	const mountAfterHydration = () => {
		window.setTimeout(() => {
			mountQueued = false
			mountOverlay()
			renderOverlay()
		}, 100)
	}

	if (document.readyState === 'complete') {
		mountAfterHydration()
	} else {
		window.addEventListener('load', mountAfterHydration, { once: true })
	}
}

function renderOverlay() {
	if (!root || !container?.isConnected) {
		scheduleMountOverlay()
		return
	}

	root.render(React.createElement(HoudiniDevtools))
}

function isRequestKind(kind: DocumentArtifact['kind']): kind is RequestKind {
	return kind !== 'HoudiniFragment'
}

function normalizeError(error: unknown): Error {
	if (error instanceof Error) {
		return error
	}

	return new Error(typeof error === 'string' ? error : JSON.stringify(error))
}

type DevtoolsMode = 'dev' | 'production' | 'never'

type HoudiniReactConfig = { devtools?: DevtoolsMode }

function reactConfig(config: ConfigFile): HoudiniReactConfig | undefined {
	return (config.plugins as { 'houdini-react'?: HoudiniReactConfig } | undefined)?.[
		'houdini-react'
	]
}

function enabled(ctx: { config: ConfigFile }) {
	const mode = reactConfig(ctx.config)?.devtools ?? 'dev'

	if (mode === 'never') {
		return false
	}

	if (mode === 'production') {
		return (import.meta as any).env?.PROD === true
	}

	return (import.meta as any).env?.DEV !== false
}

const devToolPlugin: ClientPlugin = () => {
	if (typeof window === 'undefined') {
		return {}
	}

	return {
		start(ctx, { next }) {
			if (!enabled(ctx) || !isRequestKind(ctx.artifact.kind)) {
				next(ctx)
				return
			}

			scheduleMountOverlay()
			createRequest(ctx, ctx.artifact.kind)
			addRequestEvent(ctx, 'start')

			renderOverlay()
			next(ctx)
		},
		beforeNetwork(ctx, { next }) {
			if (enabled(ctx)) {
				addRequestEvent(ctx, 'beforeNetwork')
				renderOverlay()
			}
			next(ctx)
		},
		network(ctx, { next }) {
			if (enabled(ctx)) {
				addRequestEvent(ctx, 'network')
				renderOverlay()
			}
			next(ctx)
		},
		afterNetwork(ctx, { resolve }) {
			if (enabled(ctx)) {
				addRequestEvent(ctx, 'afterNetwork')
				renderOverlay()
			}
			resolve(ctx)
		},
		end(ctx, { value, resolve }) {
			if (enabled(ctx)) {
				addRequestEvent(ctx, 'end')
				if (value.errors?.length) {
					failRequest(
						ctx,
						new Error(value.errors.map((error) => error.message).join('\n'))
					)
				} else {
					succeedRequest(ctx, value)
				}
				renderOverlay()
			}
			resolve(ctx)
		},
		catch(ctx, { error }) {
			if (enabled(ctx)) {
				addRequestEvent(ctx, 'catch')
				failRequest(ctx, normalizeError(error))
				renderOverlay()
			}
			throw error
		},
		cleanup(ctx) {
			if (enabled(ctx)) {
				addRequestEvent(ctx, 'cleanup')
				renderOverlay()
			}
		},
	}
}

export default devToolPlugin
