import type { GraphQLError } from 'houdini/runtime'
import { createContext } from 'react'

import type { Goto } from './routes.js'
import type { RouterContext } from './routing/Router.js'

// All of the runtime's React contexts are defined in this module on purpose.
//
// A React context is a module-level singleton: provider and consumer must hold
// the *same* object returned by createContext(). When a context is created
// inside a module that also exports components/hooks (like Router.tsx), Vite's
// dev server re-evaluates that module on an HMR update (for example when codegen
// rewrites a neighboring generated unit, or when react-refresh falls back to a
// full module re-run). Each re-evaluation mints a brand-new context object, and
// if a consumer rebinds to the new one while the still-mounted provider holds
// the old one, useContext() reads a context the provider never populated and
// throws "Could not find router context".
//
// This module imports only `react` at runtime (everything else is `import type`,
// erased at build time), so it is a pure leaf in the dependency graph. Route
// edits never re-evaluate it, so these context objects keep a stable identity
// across granular HMR updates. We deliberately avoid a globalThis registry to
// pin identity: multiple independent Router contexts can legitimately coexist in
// one process (for example across Astro islands), and a global singleton would
// wrongly collapse them into one.

export const RouterContextObject = createContext<RouterContext | null>(null)

export const LocationContext = createContext<{
	pathname: string
	params: Record<string, any>
	// the parsed query string of the current url (declared search params coerced to
	// their scalar type, other keys raw; repeated keys are arrays).
	search: Record<string, any>
	// a function to imperatively navigate to a url
	goto: Goto
}>({
	pathname: '',
	params: {},
	search: {},
	goto: () => {},
})

export const Is404Context = createContext(false)

// PendingURLContext (internal) carries the raw navigation target. Unlike
// NavigationContext.to it is NOT nulled when the router considers itself idle, so it
// reads the same in every render lane — the transition lane renders with isPending
// false, which would hide the target from it. useQueryResult uses this to tell whether
// the render it is part of is the destination of an in-flight navigation (suspend on a
// missing store) or the still-visible previous page (keep rendering the store it has).
export const PendingURLContext = createContext<string | null>(null)

// NavigationContext carries the router's in-flight navigation, if any: `pending` is true
// from the moment a navigation starts until the destination renders its actual content
// (it stays true while the @loading state shows), and `to` is the destination url while
// pending. Read through useNavigation().
export const NavigationContext = createContext<{
	pending: boolean
	to: string | null
	goto: Goto
}>({
	pending: false,
	to: null,
	goto: () => {},
})

export const PageContext = createContext<{ params: Record<string, any> }>({ params: {} })

// Mutable ref passed from the server renderer. It carries the HTTP status/location for
// the response and, when the first SSR render pass threw (error boundaries don't run
// during SSR), the errors the boundary should render on the second pass.
export const StatusContext = createContext<{
	status: number
	errors?: Array<Error | GraphQLError>
} | null>(null)

// FormStatusContext carries the nearest <Form>'s pending state to useMutationFormStatus(),
// the no-prop-drilling ergonomic of React's useFormStatus (which only tracks function-action
// submissions, so it can't see our forms).
export const FormStatusContext = createContext<{ pending: boolean }>({ pending: false })
