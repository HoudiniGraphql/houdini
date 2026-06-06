import { useRef } from 'react'
import { DebugPanel } from './DebugPanel'
import { useTutorial } from '../lib/state'

export function Output() {
	const { previewUrl } = useTutorial()
	const iframeRef = useRef<HTMLIFrameElement>(null)

	return (
		<div className="flex flex-col h-full bg-slate-950">
			<div className="flex-1 overflow-hidden">
				{previewUrl ? (
					<iframe
						ref={iframeRef}
						src={previewUrl}
						className="w-full h-full border-0 bg-white"
						title="Preview"
					/>
				) : (
					<div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
						<svg className="w-6 h-6 animate-spin text-pink-500" viewBox="0 0 24 24" fill="none">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
						<span className="text-sm">Starting dev server…</span>
					</div>
				)}
			</div>

			<DebugPanel />
		</div>
	)
}
