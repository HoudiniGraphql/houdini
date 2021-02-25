// externals
import { Config, Maybe, Script } from 'houdini-common'

export type TransformDocument = {
	instance: Maybe<Script>
	module: Maybe<Script>
	config: Config
	dependencies: string[]
	filename: string
}
