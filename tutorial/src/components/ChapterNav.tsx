import { useEffect, useRef, useState } from 'react'
import type { Chapter, Step } from '../lib/types'

type Props = {
	chapters: Chapter[]
	currentStep: Step | null
	onSelect: (step: Step) => void
	onClose: () => void
}

export function ChapterNav({ chapters, currentStep, onSelect, onClose }: Props) {
	const ref = useRef<HTMLDivElement>(null)
	const [expanded, setExpanded] = useState<Set<string>>(
		() => new Set(chapters.filter((ch) => ch.steps.some((s) => s.path === currentStep?.path)).map((ch) => ch.slug))
	)

	useEffect(() => {
		function onPointerDown(e: PointerEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose()
		}
		document.addEventListener('pointerdown', onPointerDown)
		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [onClose])

	function toggle(slug: string) {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(slug)) next.delete(slug)
			else next.add(slug)
			return next
		})
	}

	return (
		<div
			ref={ref}
			className="absolute left-0 top-[calc(100%+4px)] z-50 w-72 bg-surface-overlay rounded-lg overflow-y-auto max-h-[70vh]"
			style={{ border: '1px solid var(--popover-border)', boxShadow: 'var(--popover-shadow)' }}
		>
			{chapters.map((chapter) => {
				const isExpanded = expanded.has(chapter.slug)
				return (
					<div key={chapter.slug}>
						<button
							onClick={() => toggle(chapter.slug)}
							className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-fg hover:bg-surface-overlay transition-colors"
						>
							<span className={`text-[9px] text-fg-subtle transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
							{chapter.title}
						</button>
						{isExpanded && (
							<div className="pb-1">
								{chapter.steps.map((step) => {
									const isCurrent = step.path === currentStep?.path
									return (
										<button
											key={step.path}
											onClick={() => onSelect(step)}
											className={`w-full text-left px-8 py-1.5 text-sm transition-colors ${
												isCurrent
													? 'text-graphql font-medium bg-surface-overlay/50'
													: 'text-fg-muted hover:text-fg hover:bg-surface-overlay/30'
											}`}
										>
											{step.title}
										</button>
									)
								})}
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}
