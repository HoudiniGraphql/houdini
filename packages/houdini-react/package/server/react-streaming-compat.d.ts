declare module 'react-streaming-compat/server' {
	export function renderToStream(element: React.ReactElement, options?: Record<string, any>): Promise<any>
}
