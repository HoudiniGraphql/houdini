/// <reference path="../vite-env.d.ts" />

import type { DocumentArtifact } from 'houdini/runtime'
import type { ClientPlugin } from 'houdini/runtime/client'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { HoudiniDevtools } from './HoudiniDevtools'
import { addRequestEvent, createRequest, failRequest, succeedRequest } from './store'
import styles from './styles.css?inline'
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

	if (root && container?.isConnected) {
		return
	}

	mountQueued = true

	const mountAfterHydration = () => {
		window.setTimeout(() => {
			mountQueued = false
			mountOverlay()
		}, 100)
	}

	if (document.readyState === 'complete') {
		mountAfterHydration()
	} else {
		window.addEventListener('load', mountAfterHydration, { once: true })
	}
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

const devToolPlugin: ClientPlugin = () => {
	if (typeof window === 'undefined') {
		return {}
	}

	return {
		start(ctx, { next }) {
			if (!isRequestKind(ctx.artifact.kind)) {
				next(ctx)
				return
			}

			scheduleMountOverlay()
			createRequest(ctx, ctx.artifact.kind)
			addRequestEvent(ctx, 'start')
			next(ctx)
		},
		beforeNetwork(ctx, { next }) {
			addRequestEvent(ctx, 'beforeNetwork')
			next(ctx)
		},
		network(ctx, { next }) {
			addRequestEvent(ctx, 'network')
			next(ctx)
		},
		afterNetwork(ctx, { resolve }) {
			addRequestEvent(ctx, 'afterNetwork')
			resolve(ctx)
		},
		end(ctx, { value, resolve }) {
			addRequestEvent(ctx, 'end')
			if (value.errors?.length) {
				failRequest(ctx, new Error(value.errors.map((error) => error.message).join('\n')))
			} else {
				succeedRequest(ctx, value)
			}
			resolve(ctx)
		},
		catch(ctx, { error }) {
			addRequestEvent(ctx, 'catch')
			failRequest(ctx, normalizeError(error))
			throw error
		},
		cleanup(ctx) {
			addRequestEvent(ctx, 'cleanup')
		},
	}
}

export default devToolPlugin
