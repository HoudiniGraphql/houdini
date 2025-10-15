import type { ProjectManifest, routerConventions } from '.'
import type { Config } from '../../lib/config'

export type Adapter = ((args: {
	config: Config
	conventions: typeof routerConventions
	sourceDir: string
	publicBase: string
	outDir: string
	manifest: ProjectManifest
	adapterPath: string
}) => void | Promise<void>) & {
	includePaths?: Record<string, string> | ((args: { config: Config }) => Record<string, string>)
	disableServer?: boolean
	pre?: (args: {
		config: Config
		conventions: typeof routerConventions
		sourceDir: string
		publicBase: string
		outDir: string
	}) => Promise<void> | void
}
