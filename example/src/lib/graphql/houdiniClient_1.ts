import { Environment } from '$houdini'
import { buildFetchQueryFn } from './buildFetchQueryFn'
import { getSubscriptionHandler } from './getSubscriptionHandler'

const API_URL = 'localhost:4000/graphql'

const fetchQueryFn = buildFetchQueryFn({
	url: 'http://' + API_URL,
})

let socketClient = getSubscriptionHandler({ url: 'ws://' + API_URL })

export const houdiniClient = new Environment(fetchQueryFn, socketClient)
