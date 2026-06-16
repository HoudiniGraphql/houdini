import type { GraphQLError } from 'houdini/runtime'
import React from 'react'

export class GraphQLErrors extends Error {
	graphqlErrors: GraphQLError[]

	constructor(errors: GraphQLError[]) {
		super(errors.map((e) => e.message).join('\n'))
		this.name = 'GraphQLErrors'
		this.graphqlErrors = errors
	}
}

let _currentSegment: string | undefined

export function setCurrentSegment(id: string | undefined): void {
	_currentSegment = id
}

function getCurrentSegment(): string | undefined {
	return _currentSegment
}

export class RoutingError extends Error {
	status: number
	segment: string | undefined

	constructor(status: number) {
		super(`Routing error: ${status}`)
		this.name = 'RoutingError'
		this.status = status
		this.segment = getCurrentSegment()
	}
}

export class RedirectError extends Error {
	status: number
	location: string

	constructor(status: number, location: string) {
		super(`Redirect: ${status} ${location}`)
		this.name = 'RedirectError'
		this.status = status
		this.location = location
	}
}

export function isRoutingError(error: unknown): error is RoutingError {
	return error instanceof RoutingError
}

export function isApiError(error: unknown): error is GraphQLErrors {
	return error instanceof GraphQLErrors
}

export function notFound(): never {
	throw new RoutingError(404)
}

export function unauthorized(): never {
	throw new RoutingError(401)
}

export function forbidden(): never {
	throw new RoutingError(403)
}

export function httpError(status: number): never {
	throw new RoutingError(status)
}

export function redirect(status: 300 | 301 | 302 | 303 | 307 | 308, location: string): never {
	throw new RedirectError(status, location)
}

// Mutable ref passed from the server renderer so that a synchronous RoutingError
// or redirect() can propagate the correct HTTP status/location before streaming.
export const StatusContext = React.createContext<{ status: number; location?: string } | null>(null)

type HoudiniErrorBoundaryProps = {
	errorView: React.ComponentType<{
		errors: Array<Error | GraphQLError>
		children: React.ReactNode
	}>
	children: React.ReactNode
}

type HoudiniErrorBoundaryState = {
	hasError: boolean
	errors: Array<Error | GraphQLError>
}

export class HoudiniErrorBoundary extends React.Component<
	HoudiniErrorBoundaryProps,
	HoudiniErrorBoundaryState
> {
	static contextType = StatusContext
	declare context: React.ContextType<typeof StatusContext>

	constructor(
		props: HoudiniErrorBoundaryProps,
		context: React.ContextType<typeof StatusContext>
	) {
		super(props, context)
		// Second-pass SSR: statusRef is pre-set to an error status by on_render after the first
		// render threw. Start in error state immediately so children never render (and never throw).
		if (typeof window === 'undefined' && context && context.status >= 400) {
			this.state = {
				hasError: true,
				errors: [new RoutingError(context.status)],
			}
		} else {
			this.state = { hasError: false, errors: [] }
		}
	}

	static getDerivedStateFromError(error: unknown): HoudiniErrorBoundaryState {
		if (error instanceof GraphQLErrors) {
			return { hasError: true, errors: error.graphqlErrors }
		}
		return {
			hasError: true,
			errors: [error instanceof Error ? error : new Error(String(error))],
		}
	}

	componentDidCatch(error: Error): void {
		if (this.context) {
			if (error instanceof RoutingError) {
				this.context.status = error.status
			} else if (error instanceof RedirectError) {
				this.context.status = error.status
				this.context.location = error.location
			}
		}
	}

	render() {
		if (this.state.hasError) {
			const ErrorView = this.props.errorView
			return <ErrorView errors={this.state.errors}>{this.props.children}</ErrorView>
		}
		return this.props.children
	}
}
