import { Script } from 'houdini'
import { TransformPage } from 'houdini/vite'

export type SvelteTransformPage = TransformPage & {
	script: Script
}
