import { Router } from '$houdini'
import React, { Component, Suspense } from 'react'
import ReactDOM from 'react-dom/client'

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
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

ReactDOM.createRoot(document.getElementById('app')!).render(
	<ErrorBoundary>
		<Suspense fallback="root!">
			<Router />
		</Suspense>
	</ErrorBoundary>
)
