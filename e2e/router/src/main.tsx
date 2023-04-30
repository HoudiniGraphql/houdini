import {
	Router,
	suspense_cache,
	type QueryArtifact,
	type DocumentStore,
	type GraphQLObject,
	type GraphQLVariables,
} from '$houdini'
import cache from '$houdini/runtime/cache'
import React from 'react'
import ReactDOM from 'react-dom/client'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
	constructor(props: any) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true }
	}

	componentDidCatch(error: Error, info: any) {
		console.error('ErrorBoundary caught an error:', error, info)
	}

	render() {
		if (this.state.hasError) {
			return <h1>Something went wrong.</h1>
		}
		return this.props.children
	}
}

const artifact_cache = suspense_cache<QueryArtifact>()
const component_cache = suspense_cache<(props: any) => React.ReactElement>()
const data_cache = suspense_cache<DocumentStore<GraphQLObject, GraphQLVariables>>()
const pending_cache = suspense_cache<Record<string, AbortController>>()

ReactDOM.createRoot(document.getElementById('app')!).render(
	<ErrorBoundary>
		<Router
			cache={cache}
			artifact_cache={artifact_cache}
			component_cache={component_cache}
			data_cache={data_cache}
			pending_cache={pending_cache}
		/>
	</ErrorBoundary>
)
