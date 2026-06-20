export function headers() {
	return {
		'X-Houdini-Page': 'page-value',
		'X-Houdini-Shared': 'from-page',
	}
}

export default function ResponseHeadersPage() {
	return <div id="result">response headers</div>
}
