// a serialized version of the manifest is used during the build process to configure
import { Config, ProjectManifest, fs, routerConventions } from 'houdini'

// vite to see every entry point
export async function write_manifest({
	config,
	manifest,
}: {
	config: Config
	manifest: ProjectManifest
}): Promise<void> {
	// all we need to do is stringify and write the manifest to the correct location
	await fs.writeFile(
		routerConventions.serialized_manifest_path(config),
		JSON.stringify(manifest, null, 4)
	)
}
