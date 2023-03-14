import * as React from 'react'

import Child from './Child'

function App() {
	return (
		<React.Suspense fallback="loading...">
			<Child />
		</React.Suspense>
	)
}

export default App
