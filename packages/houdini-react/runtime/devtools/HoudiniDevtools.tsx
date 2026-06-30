import React from 'react'

import { HatLogo } from './HatLogo'
import { clearRequests, getSnapshot, subscribe } from './store'
import type { DevToolRequest, RequestSource } from './type'

type DetailTab = 'variables' | 'data' | 'errors'
type SourceFilterValue = 'all' | RequestSource

const DEFAULT_PANEL_HEIGHT_RATIO = 0.48
const MIN_PANEL_HEIGHT = 280
const MAX_PANEL_OFFSET = 48

export function HoudiniDevtools() {
	const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
	const [open, setOpen] = React.useState(false)
	const [selectedId, setSelectedId] = React.useState<string | null>(null)
	const [detailTab, setDetailTab] = React.useState<DetailTab>('variables')
	const [sourceFilter, setSourceFilter] = React.useState<SourceFilterValue>('all')
	const [panelHeight, setPanelHeight] = React.useState(() =>
		typeof window === 'undefined'
			? 390
			: Math.round(window.innerHeight * DEFAULT_PANEL_HEIGHT_RATIO)
	)

	const filteredRequests = React.useMemo(() => {
		if (sourceFilter === 'all') {
			return snapshot.requests
		}

		return snapshot.requests.filter((request) => getRequestSource(request) === sourceFilter)
	}, [snapshot.requests, sourceFilter])

	const latest = filteredRequests[0] ?? snapshot.requests[0]
	const selected = filteredRequests.find((request) => request.id === selectedId) ?? latest

	const startResize = React.useCallback((event: React.MouseEvent) => {
		event.preventDefault()

		const resize = (moveEvent: MouseEvent) => {
			const max = window.innerHeight - MAX_PANEL_OFFSET
			setPanelHeight(clamp(window.innerHeight - moveEvent.clientY, MIN_PANEL_HEIGHT, max))
		}

		const stop = () => {
			window.removeEventListener('mousemove', resize)
			window.removeEventListener('mouseup', stop)
		}

		window.addEventListener('mousemove', resize)
		window.addEventListener('mouseup', stop)
	}, [])

	return (
		<div className={`hdt ${open ? 'hdt--open' : 'hdt--closed'}`}>
			{open ? (
				<div className="hdt-panel" style={{ height: panelHeight }}>
					<div className="hdt-resize-handle" onMouseDown={startResize} />
					<div className="hdt-header">
						<div className="hdt-title">
							<HatLogo />
							<strong>Houdini Devtools</strong>
							<span className="hdt-count">{snapshot.requests.length} requests</span>
						</div>
						<div className="hdt-actions">
							<button className="hdt-button" type="button" onClick={clearRequests}>
								Clear
							</button>
							<button
								className="hdt-button"
								type="button"
								onClick={() => setOpen(false)}
							>
								Close
							</button>
						</div>
					</div>

					<div className="hdt-body">
						<div className="hdt-list">
							<div className="hdt-list-toolbar">
								<div>
									<div className="hdt-list-title">Requests</div>
									<div className="hdt-list-count">
										{filteredRequests.length} shown
									</div>
								</div>
								<SourceFilter value={sourceFilter} onChange={setSourceFilter} />
							</div>
							{filteredRequests.map((request) => (
								<button
									key={request.id}
									type="button"
									onClick={() => setSelectedId(request.id)}
									className={`hdt-row ${selected?.id === request.id ? 'hdt-row--selected' : ''}`}
								>
									<div className="hdt-row-title">
										<RequestDot request={request} />
										<span className="hdt-name">{request.ctx.name}</span>
										<span className="hdt-row-kind">
											{displayKind(request.kind)}
										</span>
									</div>
									<div className="hdt-row-meta">
										<span
											className={`hdt-row-source hdt-row-source--${getRequestSource(request) ?? 'unknown'}`}
										>
											{getRequestSource(request) ?? 'unknown'}
										</span>
										<span>•</span>
										<span>{getDurationMs(request)}ms</span>
									</div>
								</button>
							))}
							{filteredRequests.length === 0 ? (
								<div className="hdt-empty">No requests match this filter.</div>
							) : null}
						</div>

						<div className="hdt-detail">
							{selected ? (
								<>
									<div className="hdt-detail-header">
										<div className="hdt-heading-row">
											<h3 className="hdt-heading">{selected.ctx.name}</h3>
										</div>
										<div className="hdt-summary">
											<span className="hdt-summary-badge">
												{selected.events.length} lifecycle events
											</span>
										</div>
									</div>
									<div className="hdt-tabs">
										<TabButton
											active={detailTab === 'variables'}
											onClick={() => setDetailTab('variables')}
										>
											Variables
										</TabButton>
										<TabButton
											active={detailTab === 'data'}
											onClick={() => setDetailTab('data')}
										>
											Data
										</TabButton>
										<TabButton
											active={detailTab === 'errors'}
											onClick={() => setDetailTab('errors')}
										>
											Errors
										</TabButton>
									</div>

									{detailTab === 'variables' ? (
										<Section title="Variables" value={selected.ctx.variables} />
									) : null}
									{detailTab === 'data' ? (
										<Section
											title="Data"
											value={
												selected.status === 'success'
													? selected.result.data
													: null
											}
										/>
									) : null}
									{detailTab === 'errors' ? (
										<Section
											title="Errors"
											value={
												selected.status === 'error'
													? selected.error.message
													: selected.status === 'success'
														? selected.result.errors
														: null
											}
										/>
									) : null}
								</>
							) : (
								<div className="hdt-empty">No Houdini requests captured yet.</div>
							)}
						</div>
					</div>
				</div>
			) : (
				<button
					className="hdt-trigger"
					type="button"
					onClick={() => setOpen(true)}
					aria-label="Open Houdini Devtools"
				>
					<HatLogo />
				</button>
			)}
		</div>
	)
}

function SourceFilter({
	value,
	onChange,
}: {
	value: SourceFilterValue
	onChange: (value: SourceFilterValue) => void
}) {
	return (
		<div className="hdt-filter" aria-label="Request source filter">
			{(['all', 'cache', 'network'] as SourceFilterValue[]).map((option) => (
				<button
					key={option}
					className={`hdt-filter-button ${value === option ? 'hdt-filter-button--active' : ''}`}
					type="button"
					onClick={() => onChange(option)}
				>
					{option}
				</button>
			))}
		</div>
	)
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			className={`hdt-tab ${active ? 'hdt-tab--active' : ''}`}
			type="button"
			onClick={onClick}
		>
			{children}
		</button>
	)
}

function RequestDot({ request }: { request: DevToolRequest }) {
	const tone = request.status === 'success' ? getRequestSource(request) : request.status
	return <span className={`hdt-dot hdt-dot--${tone ?? 'unknown'}`} />
}

function getRequestSource(request: DevToolRequest) {
	return request.status === 'success' ? request.result.source : null
}

function displayKind(kind: DevToolRequest['kind']) {
	return kind.replace('Houdini', '').toLowerCase()
}

function getDurationMs(request: DevToolRequest) {
	return Math.round(getFinishedAt(request) - request.startedAt)
}

function getFinishedAt(request: DevToolRequest) {
	return request.status === 'pending' ? performance.now() : request.finishedAt
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max)
}

function Section({ title, value }: { title: string; value: unknown }) {
	const [copied, setCopied] = React.useState(false)
	const text = JSON.stringify(value ?? null, null, 2)

	const copy = async () => {
		await navigator.clipboard.writeText(text)
		setCopied(true)
		window.setTimeout(() => setCopied(false), 1200)
	}

	return (
		<div className="hdt-section">
			<div className="hdt-section-head">
				<div className="hdt-section-title">{title}</div>
				<button className="hdt-copy" type="button" onClick={copy}>
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
			<pre className="hdt-pre">{text}</pre>
		</div>
	)
}
