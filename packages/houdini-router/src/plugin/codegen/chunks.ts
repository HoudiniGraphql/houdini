import { Config } from 'houdini'

import { page_chunk_path } from '../conventions'
import type { ProjectManifest, PageManifest } from './manifest'

// Only one page is visible at any given time. This means that the router is basically a big switch
// statement of patterns to match in order to a single component given some variables.
//
// The top level router is responsible for rendering a particular page once it has everything it needs
// to render a view with the correct data. This means that we have 3 things that we have to load:
// - the actual data from the api
// - the actual page source (including layouts)
// - the artifacts for every query that the page depends on (to process the requests and provide fallback structure)
//
// It's imperative that we avoid waterfalls and load all of these things in parallel. This means that
// we need to generate a file for each part and load them at the same time. Depending on the order in
// which they resolve, we can render different things. For the rest of the flow, go to the router source.
export async function generate_chunks({
	config,
	manifest,
}: {
	config: Config
	manifest: ProjectManifest
}) {
	// every page needs a chunk directory made
	await Promise.all(
		Object.entries(manifest.pages).map(([id, page]) => generate_page_chunk({ id, page }))
	)
}

function generate_page_chunk({ id, page }: { id: string; page: PageManifest }) {}
