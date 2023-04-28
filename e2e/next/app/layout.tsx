import * as React from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html>
			<head>
				<link
					rel="icon"
					type="image/png"
					href="https://houdinigraphql.com/images/logo.png"
				/>
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Houdini • e2e • Next</title>
			</head>
			<body>{children}</body>
		</html>
	)
}
