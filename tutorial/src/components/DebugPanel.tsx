import Convert from 'ansi-to-html'
import { useCallback, useRef, useState } from 'react'
import { useTutorial } from '../lib/state'
import type { DebugEntry } from '../lib/state'

const convert = new Convert({ escapeXML: true, fg: 'currentColor' })

function stripAnsi(raw: string): string {
	return raw
		.replace(/\x1b\[[\d;?]*[A-Za-ln-z]/g, '')
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => { const parts = line.split('\r'); return parts[parts.length - 1] })
		.join('\n')
}

function toHtml(raw: string) {
	return convert.toHtml(stripAnsi(raw))
}

const SOURCE_COLORS: Record<DebugEntry['source'], string> = {
	boot:     'text-sky-700 dark:text-blue-400',
	snapshot: 'text-amber-600 dark:text-yellow-400',
	wc:       'text-emerald-700 dark:text-green-400',
}

function DebugContent() {
	const { debugLog, terminalOutput } = useTutorial()
	return (
		<div className="h-full overflow-y-auto p-2 font-mono text-xs space-y-0.5 bg-surface-deep">
			{debugLog.map((entry, i) => (
				<div key={i} className="flex gap-2">
					<span className="text-fg-subtle shrink-0">
						{new Date(entry.time).toISOString().slice(11, 23)}
					</span>
					<span className={`${SOURCE_COLORS[entry.source]} shrink-0`}>{entry.source}</span>
					<span className="text-fg-muted break-all">{entry.message}</span>
				</div>
			))}
			{terminalOutput && (
				<pre
					className="text-fg-muted whitespace-pre-wrap leading-relaxed pt-1 border-t border-edge mt-1"
					dangerouslySetInnerHTML={{ __html: toHtml(terminalOutput) }}
				/>
			)}
		</div>
	)
}

export function DebugPanel({ bare }: { bare?: boolean } = {}) {
	const { debugLog, terminalOutput } = useTutorial()
	const [open, setOpen] = useState(false)
	const [height, setHeight] = useState(256)
	const [copied, setCopied] = useState(false)
	const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

	const onDragStart = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault()
			dragRef.current = { startY: e.clientY, startHeight: height }

			const onMove = (e: PointerEvent) => {
				if (!dragRef.current) return
				const delta = dragRef.current.startY - e.clientY
				setHeight(Math.max(80, Math.min(600, dragRef.current.startHeight + delta)))
			}
			const onUp = () => {
				dragRef.current = null
				window.removeEventListener('pointermove', onMove)
				window.removeEventListener('pointerup', onUp)
			}
			window.addEventListener('pointermove', onMove)
			window.addEventListener('pointerup', onUp)
		},
		[height],
	)

	const copyAll = useCallback(() => {
		const lines: string[] = []
		for (const entry of debugLog) {
			const time = new Date(entry.time).toISOString().slice(11, 23)
			lines.push(`[${time}] ${entry.source}: ${entry.message}`)
		}
		if (terminalOutput) {
			lines.push('---')
			lines.push(stripAnsi(terminalOutput))
		}
		navigator.clipboard.writeText(lines.join('\n')).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		})
	}, [debugLog, terminalOutput])

	if (bare) return <DebugContent />

	return (
		<div className="border-t border-edge bg-surface-deep shrink-0">
			<div className="flex items-center gap-2 px-3 py-1">
				<button
					onClick={() => setOpen((o) => !o)}
					className="flex items-center gap-2 text-xs text-fg-subtle hover:text-fg-muted transition-colors flex-1 text-left"
				>
					<span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
					<span>Terminal</span>
					{debugLog.length > 0 && (
						<span className="text-fg-subtle">{debugLog.length} events</span>
					)}
				</button>
				{open && (
					<button
						onClick={copyAll}
						className="text-xs text-fg-subtle hover:text-fg-muted transition-colors px-1 py-0.5"
						title="Copy all terminal output"
					>
						{copied ? '✓ Copied' : 'Copy'}
					</button>
				)}
			</div>

			{open && (
				<>
					<div
						className="h-px cursor-ns-resize bg-edge hover:bg-graphql transition-colors"
						onPointerDown={onDragStart}
					/>
					<div style={{ height }}>
						<DebugContent />
					</div>
				</>
			)}
		</div>
	)
}
