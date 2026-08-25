import type { QueryResult } from 'houdini/runtime'
import type { ClientPluginContext } from 'houdini/runtime/documentStore'

import type { DevToolRequest, DevToolState, RequestKind, RequestPhase } from './type'

const MAX_REQUESTS = 50

let requestCounter = 0
let eventCounter = 0
// using abortcontrolller as weakmap to identify request across hooks
let requestIdsBySignal = new WeakMap<AbortSignal, string>()
let state: DevToolState = {
	requests: [],
	activeRequest: null,
}

const listeners = new Set<() => void>()

function emit() {
	for (const listener of listeners) {
		listener()
	}
}

function setState(nextState: DevToolState) {
	state = nextState
	emit()
}

function now() {
	return performance.now()
}

function nextRequestId() {
	requestCounter += 1
	return String(requestCounter)
}

function nextEventId() {
	eventCounter += 1
	return String(eventCounter)
}

function getRequestId(ctx: ClientPluginContext) {
	return requestIdsBySignal.get(ctx.abortController.signal)
}

function updateRequest(
	requestId: string | undefined,
	updater: (request: DevToolRequest) => DevToolRequest
) {
	if (!requestId) {
		return
	}

	let activeRequest = state.activeRequest
	const requests = state.requests.map((request) => {
		if (request.id !== requestId) {
			return request
		}

		const nextRequest = updater(request)
		if (activeRequest?.id === requestId) {
			activeRequest = nextRequest
		}
		return nextRequest
	})

	setState({
		requests,
		activeRequest,
	})
}

export function subscribe(listener: () => void) {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function getSnapshot() {
	return state
}

export function createRequest(ctx: ClientPluginContext, kind: RequestKind) {
	// only keep what the panel renders (name + variables) instead of the whole plugin
	// context so requests don't retain artifacts, stores, and session references
	const request: DevToolRequest = {
		id: nextRequestId(),
		kind,
		name: ctx.name,
		variables: ctx.variables ?? null,
		status: 'pending',
		startedAt: now(),
		events: [],
	}

	requestIdsBySignal.set(ctx.abortController.signal, request.id)

	setState({
		requests: [request, ...state.requests].slice(0, MAX_REQUESTS),
		activeRequest: request,
	})

	return request.id
}

export function addRequestEvent(ctx: ClientPluginContext, phase: RequestPhase) {
	updateRequest(getRequestId(ctx), (request) => ({
		...request,
		// variables can be resolved later in the pipeline, so track the latest value
		variables: ctx.variables ?? request.variables,
		events: [
			...request.events,
			{
				id: nextEventId(),
				phase,
				timestamp: now(),
			},
		],
	}))
}

export function succeedRequest(ctx: ClientPluginContext, result: QueryResult) {
	updateRequest(getRequestId(ctx), (request) => ({
		id: request.id,
		kind: request.kind,
		name: request.name,
		variables: ctx.variables ?? request.variables,
		status: 'success',
		startedAt: request.startedAt,
		finishedAt: now(),
		events: request.events,
		result,
	}))
}

export function failRequest(ctx: ClientPluginContext, error: Error) {
	updateRequest(getRequestId(ctx), (request) => ({
		id: request.id,
		kind: request.kind,
		name: request.name,
		variables: ctx.variables ?? request.variables,
		status: 'error',
		startedAt: request.startedAt,
		finishedAt: now(),
		events: request.events,
		error,
	}))
}

export function clearRequests() {
	requestIdsBySignal = new WeakMap()
	setState({
		requests: [],
		activeRequest: null,
	})
}
