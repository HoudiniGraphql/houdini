import type { Script, TransformPage } from 'houdini'

export type SvelteTransformPage = TransformPage & {
	framework: Framework
	script: Script
	svelte5Runes: boolean
}

export type Framework = 'kit' | 'svelte'
