import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ChapterNav } from '../components/ChapterNav'
import { DebugPanel } from '../components/DebugPanel'
import { Editor } from '../components/Editor'
import { FileTree } from '../components/FileTree'
import { Sidebar } from '../components/Sidebar'
import { useTutorial } from '../lib/state'

export const Route = createFileRoute('/tutorial/$chapter/$step')({
	component: TutorialPage,
})

function TutorialPage() {
	const { chapter: chapterSlug, step: stepSlug } = Route.useParams()
	const { chapters, currentStep, selectStep, solveStep, resetStep, previewUrl, files, debugLog, terminalOutput } = useTutorial()
	const [navOpen, setNavOpen] = useState(false)
	const [terminalOpen, setTerminalOpen] = useState(false)
	const [terminalHeight, setTerminalHeight] = useState(192)
	const [copied, setCopied] = useState(false)
	const [isResizing, setIsResizing] = useState(false)
	const [theme, setTheme] = useState<'dark' | 'light'>('dark')
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const terminalContainerRef = useRef<HTMLDivElement>(null)
	const terminalDrag = useRef<{ startY: number; startHeight: number } | null>(null)

	// Sync localStorage on mount before paint; on subsequent changes, persist the toggle.
	useLayoutEffect(() => {
		const saved = localStorage.getItem('tutorial-theme')
		setTheme(saved === 'light' ? 'light' : 'dark')
	}, [])

	useLayoutEffect(() => {
		document.documentElement.setAttribute('data-theme', theme)
		localStorage.setItem('tutorial-theme', theme)
	}, [theme])

	function onTerminalDragStart(e: React.PointerEvent) {
		e.preventDefault()
		setIsResizing(true)
		terminalDrag.current = { startY: e.clientY, startHeight: terminalHeight }
		const onMove = (e: PointerEvent) => {
			if (!terminalDrag.current || !terminalContainerRef.current) return
			const delta = terminalDrag.current.startY - e.clientY
			const next = Math.max(60, Math.min(600, terminalDrag.current.startHeight + delta))
			terminalContainerRef.current.style.height = `${next}px`
		}
		const onUp = (e: PointerEvent) => {
			if (terminalDrag.current && terminalContainerRef.current) {
				const delta = terminalDrag.current.startY - e.clientY
				setTerminalHeight(Math.max(60, Math.min(600, terminalDrag.current.startHeight + delta)))
			}
			terminalDrag.current = null
			setIsResizing(false)
			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('pointerup', onUp)
		}
		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', onUp)
	}

	function copyTerminal() {
		const lines: string[] = []
		for (const entry of debugLog) {
			const time = new Date(entry.time).toISOString().slice(11, 23)
			lines.push(`[${time}] ${entry.source}: ${entry.message}`)
		}
		if (terminalOutput) {
			lines.push('---')
			lines.push(terminalOutput.replace(/\x1b\[[\d;?]*[A-Za-ln-z]/g, '').replace(/\r\n/g, '\n'))
		}
		navigator.clipboard.writeText(lines.join('\n')).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		})
	}

	useEffect(() => {
		const chapter = chapters.find((c) => c.slug === chapterSlug)
		const step = chapter?.steps.find((s) => s.slug === stepSlug)
		if (step) selectStep(step)
	}, [chapterSlug, stepSlug, chapters, selectStep])

	const allSteps = chapters.flatMap((ch) => ch.steps.map((s) => ({ ...s, chapterSlug: ch.slug })))
	const currentIdx = allSteps.findIndex((s) => s.slug === stepSlug && s.chapterSlug === chapterSlug)
	const prevStep = currentIdx > 0 ? allSteps[currentIdx - 1] : null
	const nextStep = currentIdx < allSteps.length - 1 ? allSteps[currentIdx + 1] : null
	const currentChapter = chapters.find((c) => c.slug === chapterSlug)

	const isSolved =
		currentStep?.solution != null &&
		Object.entries(currentStep.solution).every(([name, contents]) => files[name] === contents)

	function refreshPreview() {
		if (iframeRef.current) iframeRef.current.src = iframeRef.current.src
	}

	const previewPath = previewUrl ? (() => { try { return new URL(previewUrl).pathname } catch { return previewUrl } })() : null

	return (
		<div className="h-dvh flex flex-col bg-surface text-fg overflow-hidden">
			{/* Top nav bar */}
			<header className="h-10 flex items-center px-3 gap-1 bg-surface-deep border-b border-edge shrink-0">
				{/* Hamburger + popup */}
				<div className="relative shrink-0">
					<button
						onClick={() => setNavOpen((o) => !o)}
						className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors"
						aria-label="Open chapter navigation"
					>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>
					{navOpen && (
						<ChapterNav
							chapters={chapters}
							currentStep={currentStep}
							onSelect={(step) => { selectStep(step); setNavOpen(false) }}
							onClose={() => setNavOpen(false)}
						/>
					)}
				</div>

				{/* Prev / Next arrows */}
				<button
					onClick={() => prevStep && selectStep(prevStep)}
					disabled={!prevStep}
					title={prevStep?.title}
					className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
				>
					←
				</button>
				<button
					onClick={() => nextStep && selectStep(nextStep)}
					disabled={!nextStep}
					title={nextStep?.title}
					className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
				>
					→
				</button>

				{/* Breadcrumb */}
				<div className="flex items-center gap-1.5 text-sm ml-1 min-w-0 overflow-hidden">
					{currentChapter && (
						<>
							<span className="text-fg-subtle truncate hidden sm:block">{currentChapter.title}</span>
							<span className="text-fg-subtle hidden sm:block">/</span>
						</>
					)}
					<span className="text-fg font-medium truncate">{currentStep?.title ?? '…'}</span>
				</div>

				<div className="flex-1" />

				{/* Theme toggle */}
				<button
					onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
					title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
					className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors shrink-0"
				>
					{theme === 'dark' ? (
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
					) : (
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
						</svg>
					)}
				</button>

				{/* Solve / Reset button */}
				{currentStep?.solution && (
					<button
						onClick={isSolved ? resetStep : solveStep}
						className={`shrink-0 px-3 py-1 rounded text-sm font-medium transition-colors ${
							isSolved
								? 'bg-surface-overlay text-fg-muted hover:bg-surface-overlay/80'
								: 'bg-graphql text-white hover:opacity-90'
						}`}
					>
						{isSolved ? 'reset' : 'solve →'}
					</button>
				)}
			</header>

			{/* Main panels */}
			<PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
				{/* Left: prose */}
				<Panel defaultSize={33} minSize={20} maxSize={50}>
					<Sidebar />
				</Panel>

				<PanelResizeHandle onDragging={setIsResizing} className="w-px bg-edge hover:bg-graphql transition-colors data-[resize-handle-active]:bg-graphql" />

				{/* Right: editor + preview */}
				<Panel>
					<PanelGroup direction="vertical">
						{/* Editor area */}
						<Panel defaultSize={55} minSize={20}>
							<PanelGroup direction="horizontal">
								<Panel defaultSize={20} minSize={12} maxSize={35}>
									<FileTree />
								</Panel>
								<PanelResizeHandle onDragging={setIsResizing} className="w-px bg-edge hover:bg-graphql transition-colors data-[resize-handle-active]:bg-graphql" />
								<Panel>
									<Editor dark={theme === 'dark'} />
								</Panel>
							</PanelGroup>
						</Panel>

						<PanelResizeHandle onDragging={setIsResizing} className="h-px bg-edge hover:bg-graphql transition-colors data-[resize-handle-active]:bg-graphql" />

						{/* Preview area */}
						<Panel defaultSize={45} minSize={15}>
							<div className="h-full flex flex-col bg-surface-deep">
								{/* URL bar */}
								<div className="flex items-center gap-2 px-2 h-9 bg-surface border-b border-edge shrink-0">
									<button
										onClick={refreshPreview}
										title="Refresh preview"
										className="p-1.5 rounded text-fg-subtle hover:text-fg hover:bg-surface-raised transition-colors shrink-0"
									>
										<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
											<path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
										</svg>
									</button>
									<div className="flex-1 px-2 py-0.5 rounded bg-surface-raised text-xs text-fg-muted font-mono truncate min-w-0">
										{previewPath ?? 'starting…'}
									</div>
									<button
										onClick={() => setTerminalOpen((o) => !o)}
										title="Toggle terminal"
										className={`shrink-0 px-2 py-1 rounded text-xs font-mono transition-colors ${
											terminalOpen
												? 'bg-surface-overlay text-fg'
												: 'text-fg-subtle hover:text-fg hover:bg-surface-raised'
										}`}
									>
										{'>_'}
									</button>
								</div>

								{/* Iframe + optional terminal */}
								<div className="flex-1 flex flex-col overflow-hidden min-h-0">
									<div className="flex-1 overflow-hidden min-h-0 bg-surface">
										{previewUrl ? (
											<iframe
												ref={iframeRef}
												src={previewUrl}
												className="w-full h-full border-0 bg-white"
												style={{ pointerEvents: isResizing ? 'none' : undefined }}
												title="Preview"
											/>
										) : (
											<div className="flex flex-col items-center justify-center h-full gap-3 text-fg-subtle">
												<svg className="w-6 h-6 animate-spin text-graphql" viewBox="0 0 24 24" fill="none">
													<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
													<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
												</svg>
												<span className="text-sm">Starting dev server…</span>
											</div>
										)}
									</div>
									{terminalOpen && (
										<div ref={terminalContainerRef} className="border-t border-edge shrink-0 flex flex-col" style={{ height: terminalHeight }}>
											<div
												className="h-1.5 shrink-0 cursor-ns-resize bg-surface-raised hover:bg-graphql transition-colors"
												onPointerDown={onTerminalDragStart}
											/>
											<div className="flex items-center justify-between px-2 py-0.5 shrink-0">
												<span className="text-xs text-fg-subtle font-mono">terminal</span>
												<button
													onClick={copyTerminal}
													className="text-xs text-fg-subtle hover:text-fg-muted transition-colors px-1 py-0.5"
												>
													{copied ? '✓ copied' : 'copy'}
												</button>
											</div>
											<div className="flex-1 min-h-0">
												<DebugPanel bare />
											</div>
										</div>
									)}
								</div>
							</div>
						</Panel>
					</PanelGroup>
				</Panel>
			</PanelGroup>
		</div>
	)
}
