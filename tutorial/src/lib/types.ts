export type Step = {
	title: string
	slug: string
	path: string
	markdown: string
	files: Record<string, string>
	solution: Record<string, string> | null
	remove: string[]
}

export type Chapter = {
	title: string
	slug: string
	openDirs: string[]
	steps: Step[]
}

export type TutorialManifest = {
	id: string
	title: string
	commands: Array<{ command: string; args: string[] }>
	chapters: Chapter[]
	applyOrder?: string[]
	completionSignal?: string
}
