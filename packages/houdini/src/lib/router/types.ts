import { routerConventions } from '.'
import { Config } from '../config'

export type Adapter = (args: {
	config: Config
	conventions: typeof routerConventions
	sourceDir: string
}) => void | Promise<void>
