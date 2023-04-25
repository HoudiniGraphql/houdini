import { Router } from '$houdini'
import { Suspense } from 'react'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById('app')!).render(
	<Suspense fallback="loding...">
		<Router />
	</Suspense>
)
