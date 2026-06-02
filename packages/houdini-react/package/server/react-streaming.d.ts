declare module 'react-streaming/server' {
	export function renderToStream(
		element: React.ReactElement,
		options?: Record<string, any>
	): Promise<any>
}
