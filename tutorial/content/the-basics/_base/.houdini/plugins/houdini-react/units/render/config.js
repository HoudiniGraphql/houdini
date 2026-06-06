import { createServerAdapter as createAdapter } from './server'
import config_file from '../../../../../houdini.config'

import schema from '../../../../../src/api/+schema'
const yoga = null

export const endpoint = "/_api"

export const componentCache = {}

export function createServerAdapter(options) {
	return createAdapter({
		schema,
		yoga,
		componentCache,
		graphqlEndpoint: endpoint,
		config_file,
		...options,
	})
}
