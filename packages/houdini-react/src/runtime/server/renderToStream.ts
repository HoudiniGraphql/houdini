import React from 'react'
import {
	renderToPipeableStream,
	renderToReadableStream,
} from 'react-dom/server'

import { createPipeWrapper, Pipe } from './renderToStream/createPipeWrapper'
import { createReadableWrapper } from './renderToStream/createReadableWrapper'
import { resolveSeoStrategy, SeoStrategy } from './renderToStream/resolveSeoStrategy'
import { nodeStreamModuleIsAvailable } from './renderToStream/loadNodeStreamModule'
import { createDebugger } from './utils'

export { renderToStream }
export { disable }

const debug = createDebugger('react-streaming:flow')

type Options = {
	webStream?: boolean
	disable?: boolean
	seoStrategy?: SeoStrategy
	userAgent?: string
	onBoundaryError?: (err: unknown) => void
	renderToReadableStream?: typeof renderToReadableStream
	renderToPipeableStream?: typeof renderToPipeableStream
}
type Result = (
	| {
			pipe: Pipe
			readable: null
	  }
	| {
			pipe: null
			readable: ReadableStream
	  }
) & {
	streamEnd: Promise<boolean>
	disabled: boolean
	injectToStream: (chunk: unknown) => void
}

const globalConfig: { disable: boolean } = ((globalThis as any).__react_streaming = (
	globalThis as any
).__react_streaming || {
	disable: false,
})
function disable() {
	globalConfig.disable = true
}

async function renderToStream(element: React.ReactNode, options: Options = {}): Promise<Result> {
	const buffer: unknown[] = []
	let injectToStream: (chunk: unknown) => void = (chunk) => buffer.push(chunk)
	element = React.cloneElement(element as React.ReactElement, { injectToStream })

	const disable =
		globalConfig.disable || (options.disable ?? resolveSeoStrategy(options).disableStream)

	const webStream = process.env.NODE_ENV === 'production' || (options.webStream ?? !(await nodeStreamModuleIsAvailable()))

	debug(`disable === ${disable} && webStream === ${webStream}`)

	let result: Result
	const resultPartial: Pick<Result, 'disabled'> = { disabled: disable }
	if (!webStream) {
		result = { ...resultPartial, ...(await renderToNodeStream(element, disable, options)) }
	} else {
		result = { ...resultPartial, ...(await renderToWebStream(element, disable, options)) }
	}

	injectToStream = result.injectToStream
	buffer.forEach((chunk) => injectToStream(chunk))
	buffer.length = 0

	debug('promise `await renderToStream()` resolved')
	return result
}

async function renderToNodeStream(
	element: React.ReactNode,
	disable: boolean,
	options: {
		debug?: boolean
		onBoundaryError?: (err: unknown) => void
		renderToPipeableStream?: typeof renderToPipeableStream
	}
) {
	debug('creating Node.js Stream Pipe')

	let onAllReady!: () => void
	const allReady = new Promise<void>((r) => {
		onAllReady = () => r()
	})
	let onShellReady!: () => void
	const shellReady = new Promise<void>((r) => {
		onShellReady = () => r()
	})

	let didError = false
	let firstErr: unknown = null
	let reactBug: unknown = null
	const onError = (err: unknown) => {
		debug('[react] onError() / onShellError()')
		didError = true
		firstErr ??= err
		onShellReady()
		afterReactBugCatch(() => {
			// Is not a React internal error (i.e. a React bug)
			if (err !== reactBug) {
				options.onBoundaryError?.(err)
			}
		})
	}

	const { pipe: pipeOriginal } = renderToPipeableStream(element, {
		onShellReady() {
			debug('[react] onShellReady()')
			onShellReady()
		},
		onAllReady() {
			debug('[react] onAllReady()')
			onShellReady()
			onAllReady()
		},
		onShellError: onError,
		onError,
	})
	let promiseResolved = false
	const { pipeForUser, injectToStream, streamEnd } = await createPipeWrapper(pipeOriginal, {
		onReactBug(err) {
			debug('react bug')
			didError = true
			firstErr ??= err
			reactBug = err
			// Only log if it wasn't used as rejection for `await renderToStream()`
			if (reactBug !== firstErr || promiseResolved) {
				console.error(reactBug)
			}
		},
	})
	await shellReady
	if (didError) throw firstErr
	if (disable) await allReady
	if (didError) throw firstErr
	promiseResolved = true
	return {
		pipe: pipeForUser,
		readable: null,
		streamEnd: wrapStreamEnd(streamEnd, didError),
		injectToStream,
	}
}
async function renderToWebStream(
	element: React.ReactNode,
	disable: boolean,
	options: {
		debug?: boolean
		onBoundaryError?: (err: unknown) => void
		renderToReadableStream?: typeof renderToReadableStream
	}
) {
	debug('creating Web Stream Pipe')

	let didError = false
	let firstErr: unknown = null
	let reactBug: unknown = null
	const onError = (err: unknown) => {
		didError = true
		firstErr = firstErr || err
		afterReactBugCatch(() => {
			// Is not a React internal error (i.e. a React bug)
			if (err !== reactBug) {
				options.onBoundaryError?.(err)
			}
		})
	}

	const readableOriginal = await renderToReadableStream(element, { onError })
	const { allReady } = readableOriginal
	let promiseResolved = false
	// Upon React internal errors (i.e. React bugs), React rejects `allReady`.
	// React doesn't reject `allReady` upon boundary errors.
	allReady.catch((err) => {
		debug('react bug')
		didError = true
		firstErr = firstErr || err
		reactBug = err
		// Only log if it wasn't used as rejection for `await renderToStream()`
		if (reactBug !== firstErr || promiseResolved) {
			console.error(reactBug)
		}
	})
	if (didError) throw firstErr
	if (disable) await allReady
	if (didError) throw firstErr
	const { readableForUser, streamEnd, injectToStream } = createReadableWrapper(readableOriginal)
	promiseResolved = true
	return {
		readable: readableForUser,
		pipe: null,
		streamEnd: wrapStreamEnd(streamEnd, didError),
		injectToStream,
	}
}

// Needed for the hacky solution to workaround https://github.com/facebook/react/issues/24536
function afterReactBugCatch(fn: Function) {
	setTimeout(() => {
		fn()
	}, 0)
}
function wrapStreamEnd(streamEnd: Promise<void>, didError: boolean): Promise<boolean> {
	return (
		streamEnd
			// Needed because of the `afterReactBugCatch()` hack above, otherwise `onBoundaryError` triggers after `streamEnd` resolved
			.then(() => new Promise<void>((r) => setTimeout(r, 0)))
			.then(() => !didError)
	)
}
