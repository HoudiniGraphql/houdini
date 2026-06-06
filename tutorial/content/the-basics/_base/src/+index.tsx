import React from 'react'

export default function App({ children }: { children: React.ReactNode }) {
	return (
		<html>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>Houdini Tutorial</title>
			</head>
			<body>
				<ErrorBoundary>{children}</ErrorBoundary>
			</body>
		</html>
	)
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
	constructor(props: { children: React.ReactNode }) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(_error: Error) {
		return { hasError: true }
	}

	componentDidCatch(error: Error, info: {}) {
		console.error('ErrorBoundary caught an error:', error, info)
	}

	render() {
		if (this.state.hasError) {
			return <h1>Something went wrong.</h1>
		}
		return this.props.children
	}
}
