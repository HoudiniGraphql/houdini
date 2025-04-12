import type { ProjectManifest } from 'houdini'

export let manifest: ProjectManifest

export function setManifest(newManifest: ProjectManifest): void {
	manifest = newManifest
}
