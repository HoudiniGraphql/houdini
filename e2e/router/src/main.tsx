import { Router, routerCache } from '$houdini'
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
const suspenseCaches = routerCache()

ReactDOM.createRoot(document.getElementById('app')!).render(
	<ErrorBoundary>
		<Router cache={cache} {...suspenseCaches} />
	</ErrorBoundary>
)
