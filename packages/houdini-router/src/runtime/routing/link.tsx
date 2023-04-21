import React, { useTransition } from 'react'

import { useRouterContext } from './router'

export function Link({
	to,
	children,
	style,
	...props
}: {
	to: string
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
			goto(to)
		})
	}

	return (
		<a href={to} onClick={click} style={style} {...props}>
			{children}
		</a>
	)
}
