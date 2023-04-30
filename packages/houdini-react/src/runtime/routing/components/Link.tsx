import React, { useTransition } from 'react'

import { useRouterContext } from './Router'

export function Link({
	href,
	children,
	style,
	...props
}: {
	href: string
	children: React.ReactNode
	style?: React.CSSProperties
}) {
	// grab the router context
	const { goto } = useRouterContext()

	// the route navigation needs to happen in a transition
	const [pending, startTransition] = useTransition()

	// the click handler for the link needs to navigate to the page
	// as a transition
	const click = (e: React.SyntheticEvent) => {
		e.preventDefault()
		startTransition(() => {
			goto(href)
		})
	}

	return (
		<a href={href} onClick={click} style={style} {...props}>
			{children}
		</a>
	)
}
