import { Config, fs } from 'houdini'

import { page_bundle_path } from '../conventions'
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
export async function generate_bundles({
	config,
	manifest,
}: {
	config: Config
	manifest: ProjectManifest
}) {
	// every page needs a bundle directory made
	await Promise.all(
		Object.entries(manifest.pages).map(([id, page]) =>
			generate_page_bundle({ id, page, config, project: manifest })
		)
	)
}

type PageBundleInput = {
	id: string
	page: PageManifest
	project: ProjectManifest
	config: Config
}

async function generate_page_bundle(args: PageBundleInput) {
	const bundle_path = page_bundle_path(args.config, args.id)

	// the first thing we need to do is make sure that the page has a bundle directory
	await fs.mkdirp(bundle_path)

	// write the appropriate files in each bundle
	await Promise.all([bundle_index(args)])
}

// the entry point that the router hooks into the orchestrate the page
async function bundle_index(args: PageBundleInput) {}

// the file that actually performs the query load
async function bundle_load(args: PageBundleInput) {}
