import { Script } from 'houdini'
import { TransformPage } from 'houdini/vite'

import { Framework } from '../kit'

export type SvelteTransformPage = TransformPage & {
	framework: Framework
	script: Script
}
