import { HoudiniClient } from '$houdini'
import { buildFetchQueryFn } from './buildFetchQueryFn'
import { getSubscriptionHandler } from './getSubscriptionHandler'

const API_URL = 'localhost:4000/graphql'

export type AppHeaders = {
	Authorization?: `Bearer ${string}`
	//...more headers
}

const fetchQueryFn = buildFetchQueryFn<AppHeaders>({
	url: 'http://' + API_URL,
	credentials: 'omit',
	headers: { Authorization: 'Bearer <token>' },
})

let socketClient = getSubscriptionHandler({ url: 'ws://' + API_URL })

export const houdiniClient = new HoudiniClient(fetchQueryFn, socketClient)
