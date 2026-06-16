import type { DocumentArtifact, QueryResult } from 'houdini/runtime'
import type { ClientHooks, ClientPluginContext } from 'houdini/runtime/documentStore'

export type RequestStatus = 'pending' | 'success' | 'error'

export type RequestPhase = keyof ClientHooks

export type RequestEvent = {
	id: string
	phase: RequestPhase
	timestamp: number
}

export type RequestKind = Exclude<DocumentArtifact['kind'], 'HoudiniFragment'>

type BaseRequest = {
	id: string
	kind: RequestKind
	ctx: ClientPluginContext
	startedAt: number
	events: RequestEvent[]
}

type PendingRequest = BaseRequest & {
	status: 'pending'
}

type SuccessfulRequest = BaseRequest & {
	status: 'success'
	finishedAt: number
	result: QueryResult
}

type ErrorRequest = BaseRequest & {
	status: 'error'
	finishedAt: number
	error: Error
}

export type DevToolRequest = PendingRequest | SuccessfulRequest | ErrorRequest

export type DevToolState = {
	requests: DevToolRequest[]
	activeRequest: DevToolRequest | null
}
