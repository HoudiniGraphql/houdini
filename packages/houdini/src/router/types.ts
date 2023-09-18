import type { ProjectManifest, routerConventions } from '.'
import type { Config } from '../lib/config'

export type Adapter = (args: {
	config: Config
	conventions: typeof routerConventions
	sourceDir: string
	publicBase: string
	outDir: string
	manifest: ProjectManifest
}) => void | Promise<void>
