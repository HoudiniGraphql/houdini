import { HoudiniPlugin } from 'houdini/common'

import generate from './codegen'
import extract from './extract'
import apply_transforms from './transforms'

export default async (): Promise<HoudiniPlugin> => ({
	extensions: ['.svelte'],

	// custom logic to pull a graphql document out of a svelte file
	extract_documents: extract,

	// transform a file's contents. changes here aren't seen by extract_documents
	transform_file: apply_transforms,

	// when we're done generating, we need to write the svelte specific runtime
	after_generate: generate,
})
