import { createContext, useContext } from 'react'
import type { Chapter, Step } from './types'

export type DebugEntry = { time: number; source: 'wc' | 'snapshot' | 'boot'; message: string }

export type TutorialState = {
	// content
	chapters: Chapter[]
	currentStep: Step | null
	openDirs: string[]

	// editor
	files: Record<string, string> // name → current contents (with user edits)
	wcFiles: string[]             // all paths visible in the WC filesystem
	selectedFile: string | null

	// webcontainer
	previewUrl: string | null
	terminalOutput: string
	debugLog: DebugEntry[]

	// actions
	selectStep: (step: Step) => void
	selectFile: (name: string) => Promise<void>
	updateFile: (name: string, contents: string) => void
	solveStep: () => void
	resetStep: () => void
}

export const TutorialContext = createContext<TutorialState | null>(null)

export function useTutorial(): TutorialState {
	const ctx = useContext(TutorialContext)
	if (!ctx) throw new Error('useTutorial must be used inside TutorialProvider')
	return ctx
}
