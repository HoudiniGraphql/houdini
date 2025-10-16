import type { Script, TransformPage  } from 'houdini'

import type { Framework } from './paths'

export type SvelteTransformPage = TransformPage & {
	framework: Framework
	script: Script
	svelte5Runes: boolean
}
