import type { Script } from 'houdini'
import type { TransformPage } from 'houdini'

import type { Framework } from '../kit'

export type SvelteTransformPage = TransformPage & {
	framework: Framework
	script: Script
	svelte5Runes: boolean
}
