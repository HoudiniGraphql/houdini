import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
	loader: () => {
		throw redirect({ to: '/tutorial/$chapter/$step', params: { chapter: '01-intro', step: '01-welcome' } })
	},
	component: () => null,
})
