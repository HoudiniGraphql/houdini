import React from 'react'

import { clearRequests, getSnapshot, subscribe } from './store'
import type { DevToolRequest } from './type'

function StatusDot({ status }: { status: string }) {
	return <span className={`hdt-dot hdt-dot--${status}`} />
}

type DetailTab = 'variables' | 'data' | 'errors'

export function HoudiniDevtools() {
	const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
	const [open, setOpen] = React.useState(false)
	const [selectedId, setSelectedId] = React.useState<string | null>(null)
	const [detailTab, setDetailTab] = React.useState<DetailTab>('variables')

	const latest = snapshot.requests[0]
	const selected = snapshot.requests.find((request) => request.id === selectedId) ?? latest

	return (
		<div className={`hdt ${open ? 'hdt--open' : 'hdt--closed'}`}>
			{open ? (
				<div className="hdt-panel">
					<div className="hdt-header">
						<div className="hdt-title">
							<span>🎩</span>
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
							{snapshot.requests.map((request) => (
								<button
									key={request.id}
									type="button"
									onClick={() => setSelectedId(request.id)}
									className={`hdt-row ${selected?.id === request.id ? 'hdt-row--selected' : ''}`}
								>
									<div className="hdt-row-title">
										<StatusDot status={request.status} />
										<span className="hdt-name">{request.ctx.name}</span>
										<span className="hdt-row-kind">
											{displayKind(request.kind)}
										</span>
									</div>
									<div className="hdt-row-meta">
										{getRequestSource(request) ?? 'unknown'} •{' '}
										{getDurationMs(request)}ms
									</div>
								</button>
							))}
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
								<div className="hdt-count">No Houdini requests captured yet.</div>
							)}
						</div>
					</div>
				</div>
			) : (
				<button className="hdt-trigger" type="button" onClick={() => setOpen(true)}>
					<span>🎩</span>
					<strong>Houdini Devtools</strong>
					<StatusDot status={latest?.status ?? 'success'} />
				</button>
			)}
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
