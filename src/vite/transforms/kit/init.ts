import { ensure_imports } from '../../imports'
import { TransformPage } from '../../plugin'

export default async function kit_init(page: TransformPage) {
	// we only care about the root layout file
	if (!page.config.isRootLayout(page.filepath)) {
		return
	}

	// all we need to do is make sure that something imports the adapter
	ensure_imports({
		page,
		sourceModule: '$houdini/runtime/adapter',
	})
}
