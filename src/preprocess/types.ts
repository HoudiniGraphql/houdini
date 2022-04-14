// externals
import { Config, Maybe, Script } from '../common'

export type TransformDocument = {
	instance: Maybe<Script>
	module: Maybe<Script>
	config: Config
	dependencies: string[]
	filename: string
}
