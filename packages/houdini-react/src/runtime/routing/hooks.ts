import React from 'react'
import { useContext } from 'react'

import configFile from '$houdini/runtime/imports/config'
import { DocumentStore, HoudiniClient } from '$houdini/runtime/client'

import type { SuspenseCache } from './cache'
import type { QueryArtifact } from '$houdini/runtime/lib/types'
import type { GraphQLObject, GraphQLVariables } from '$houdini/runtime/lib/types'
import type { LRUCache } from '$houdini/runtime/lib/lru'

export type PageComponent = React.ComponentType<{ url: string }>

export type PendingCache = SuspenseCache<
	Promise<void> & { resolve: () => void; reject: (message: string) => void }
>

type RouterContext = {
    client: HoudiniClient
    cache: Cache

    // We also need a cache for artifacts so that we can avoid suspending to
    // load them if possible.
    artifact_cache: SuspenseCache<QueryArtifact>

    // We also need a cache for component references so we can avoid suspending
    // when we load the same page multiple times
    component_cache: SuspenseCache<PageComponent>

    // Pages need a way to wait for data
    data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>

    // A way to dedupe requests for a query
    ssr_signals: PendingCache

    // A way to track the last known good variables
    last_variables: LRUCache<GraphQLVariables>

    // The current session
    session: App.Session

    // a function to call that sets the client-side session singletone
    setSession: (newSession: Partial<App.Session>) => void
}

export const Context = React.createContext<RouterContext | null>(null)

const LocationContext = React.createContext<{
    pathname: string
    params: Record<string, any>
    // a function to imperatively navigate to a url
    goto: (url: string) => void
}>({
    pathname: '',
    params: {},
    goto: () => {},
})
// export the location information in context
export const useLocation = () => useContext(LocationContext)

export const useRouterContext = () => {
	const ctx = React.useContext(Context)

	if (!ctx) {
		throw new Error('Could not find router context')
	}

	return ctx
}

export function useClient() {
	return useRouterContext().client
}

export function useCache() {
	return useRouterContext().cache
}

export function useSession(): [App.Session, (newSession: Partial<App.Session>) => void] {
    const ctx = useRouterContext()

    // when we update the session we have to do 2 things. (1) we have to update the local state
    // that we will use on the client (2) we have to send a request to the server so that it
    // can update the cookie that we use for the session
    const updateSession = (newSession: Partial<App.Session>) => {
        // clear the data cache so that we refetch queries with the new session (will force a cache-lookup)
        ctx.data_cache.clear()

        // update the local state
        ctx.setSession(newSession)

        // figure out the url that we will use to send values to the server
        const auth = configFile.router?.auth
        if (!auth) {
            return
        }
        const url = 'redirect' in auth ? auth.redirect : auth.url

        fetch(url, {
            method: 'POST',
            body: JSON.stringify(newSession),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        })
    }

    return [ctx.session, updateSession]
}
