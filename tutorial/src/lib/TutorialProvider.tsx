import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TutorialContext, type DebugEntry, type TutorialState } from './state'
import type { Step, TutorialManifest } from './types'
import { boot, listFiles, mountStepFiles, readWcFile, writeFile } from './webcontainer'

export function TutorialProvider({ content, children }: { content: TutorialManifest; children: ReactNode }) {
	const [currentStep, setCurrentStep] = useState<Step | null>(null)
	const [files, setFiles] = useState<Record<string, string>>({})
	const [wcFiles, setWcFiles] = useState<string[]>([])
	const [selectedFile, setSelectedFile] = useState<string | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [debugLog, setDebugLog] = useState<DebugEntry[]>([])
	const booted = useRef(false)
	const fsPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const filePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const bootDeferred = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null)
	if (!bootDeferred.current) {
		let resolve!: () => void
		const promise = new Promise<void>((r) => { resolve = r })
		bootDeferred.current = { promise, resolve }
	}

	const [terminalOutput, setTerminalOutput] = useState('')
	const terminalRef = useRef('')
	const appendOutput = (chunk: string) => {
		terminalRef.current += chunk
		setTerminalOutput((prev) => prev + chunk)
	}
	const appendDebug = (source: DebugEntry['source'], message: string) =>
		setDebugLog((prev) => [...prev, { time: Date.now(), source, message }])

	useEffect(() => {
		if (booted.current) return
		booted.current = true

		appendDebug('boot', `Fetching snapshot: /snapshots/${content.id}.bin`)
		boot(
			content.id,
			appendOutput,
			(url) => {
				appendDebug('boot', `server-ready: ${url}`)
				setPreviewUrl(url)
				// Resolve after server is ready so mountStepFiles doesn't write
				// files mid-startup and trigger repeated codegen cycles.
				bootDeferred.current?.resolve()
			},
			appendDebug,
		).then(async (wc) => {
			// Start polling the WC filesystem so newly generated files appear.
			// Kept alive for the component lifetime — never cleared on command exit.
			const pollFs = async () => { setWcFiles(await listFiles()) }
			await pollFs()
			fsPollRef.current = setInterval(pollFs, 2000)

			for (const { command, args } of content.commands) {
				appendDebug('boot', `spawn: ${command} ${args.join(' ')}`)
				const proc = await wc.spawn(command, args, { terminal: { rows: 24, cols: 120 } })
				proc.output.pipeTo(new WritableStream({ write: appendOutput }))
				proc.exit.then((code) => {
					appendDebug('boot', `${command} exited with code ${code}`)
					if (code !== 0) {
						console.error(`[wc] ${command} exited code ${code}`)
						console.error('[wc] last output:\n' + terminalRef.current.slice(-3000))
					}
				})
			}
		}).catch((err) => {
			appendDebug('boot', `ERROR: ${err}`)
		})
		return () => {
			if (fsPollRef.current) clearInterval(fsPollRef.current)
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	// Poll the selected file's content when it's a generated (non-step) file.
	const currentStepFiles = currentStep?.files ?? null
	useEffect(() => {
		if (filePollRef.current) clearInterval(filePollRef.current)
		if (!selectedFile) return
		if (currentStepFiles && selectedFile in currentStepFiles) return
		filePollRef.current = setInterval(async () => {
			try {
				const contents = await readWcFile(selectedFile)
				setFiles((prev) => {
					if (prev[selectedFile] === contents) return prev
					return { ...prev, [selectedFile]: contents }
				})
			} catch {}
		}, 1500)
		return () => {
			if (filePollRef.current) clearInterval(filePollRef.current)
		}
	}, [selectedFile, currentStepFiles])

	async function selectStep(step: Step) {
		if (step.path === currentStep?.path) return
		setCurrentStep(step)
		setFiles(step.files)
		setSelectedFile(Object.keys(step.files)[0] ?? null)
		await bootDeferred.current!.promise
		await mountStepFiles(step.files, step.remove)
	}

	async function selectFile(name: string) {
		setSelectedFile(name)
		// Always re-read generated (non-step) files so we see the latest WC content.
		// Step files are already tracked in `files` and may have unsaved edits.
		const isStepFile = currentStep?.files != null && name in currentStep.files
		if (!isStepFile) {
			try {
				const contents = await readWcFile(name)
				setFiles((prev) => ({ ...prev, [name]: contents }))
			} catch {}
		}
	}

	const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

	function updateFile(name: string, contents: string) {
		setFiles((prev) => ({ ...prev, [name]: contents }))
		clearTimeout(saveTimers.current[name])
		saveTimers.current[name] = setTimeout(() => writeFile(name, contents), 100)
	}

	async function applyFiles(files: Record<string, string>) {
		const { applyOrder, completionSignal } = content
		if (!applyOrder?.length) {
			await mountStepFiles(files)
			return
		}

		const entries = Object.entries(files)
		const firstFiles = Object.fromEntries(entries.filter(([k]) => applyOrder.some((ext) => k.endsWith(ext))))
		const restFiles = Object.fromEntries(entries.filter(([k]) => !applyOrder.some((ext) => k.endsWith(ext))))

		if (Object.keys(firstFiles).length === 0) {
			await mountStepFiles(files)
			return
		}

		const offsetBefore = terminalRef.current.length
		await mountStepFiles(firstFiles)

		if (completionSignal) {
			const deadline = Date.now() + 20_000
			while (Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, 200))
				if (terminalRef.current.slice(offsetBefore).includes(completionSignal)) break
			}
		}

		if (Object.keys(restFiles).length > 0) {
			await mountStepFiles(restFiles)
		}
	}

	async function solveStep() {
		if (!currentStep?.solution) return
		setFiles(currentStep.solution)
		await applyFiles(currentStep.solution)
	}

	async function resetStep() {
		if (!currentStep) return
		setFiles(currentStep.files)
		await applyFiles(currentStep.files)
	}

	const currentChapter = content.chapters.find((ch) =>
		ch.steps.some((s) => s.path === currentStep?.path)
	)

	const openDirs = useMemo(
		() => currentChapter?.openDirs ?? [],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[currentChapter?.slug]
	)

	const state: TutorialState = {
		chapters: content.chapters,
		currentStep,
		openDirs,
		files,
		wcFiles,
		selectedFile,
		previewUrl,
		terminalOutput,
		debugLog,
		selectStep,
		selectFile,
		updateFile,
		solveStep,
		resetStep,
	}

	return <TutorialContext.Provider value={state}>{children}</TutorialContext.Provider>
}
