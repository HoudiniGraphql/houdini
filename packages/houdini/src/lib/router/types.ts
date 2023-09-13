import { routerConventions } from '.'
import { Config } from '../config'

export type Adapter = (args: {
	config: Config
	conventions: typeof routerConventions
	sourceDir: string
	publicBase: string
}) => void | Promise<void>
