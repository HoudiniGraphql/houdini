import type { Script } from 'houdini'
import type { TransformPage } from 'houdini/vite'

import type { Framework } from '../kit'

export type SvelteTransformPage = TransformPage & {
	framework: Framework
	script: Script
}
