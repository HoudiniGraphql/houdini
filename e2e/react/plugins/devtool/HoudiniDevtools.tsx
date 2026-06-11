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

	React.useEffect(() => {
		if (!selected) {
			return
		}

		console.log('[Houdini Devtools] selected request', selected)
	}, [selected])

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
							<button className="hdt-button" onClick={clearRequests}>
								Clear
							</button>
							<button className="hdt-button" onClick={() => setOpen(false)}>
								Close
							</button>
						</div>
					</div>

					<div className="hdt-body">
						<div className="hdt-list">
							{snapshot.requests.map((request) => (
								<button
									key={request.id}
									onClick={() => setSelectedId(request.id)}
									className={`hdt-row ${selected?.id === request.id ? 'hdt-row--selected' : ''}`}
								>
									<div className="hdt-row-title">
										<StatusDot status={request.status} />
										<span className="hdt-name">{request.ctx.name}</span>
									</div>
									<div className="hdt-row-meta">
										{displayKind(request.kind)} • {request.status} • {getDurationMs(request)}ms
									</div>
								</button>
							))}
						</div>

						<div className="hdt-detail">
							{selected ? (
								<>
									<h3 className="hdt-heading">{selected.ctx.name}</h3>
									<div className="hdt-pills">
										<span className="hdt-pill">{displayKind(selected.kind)}</span>
										<span className="hdt-pill">{selected.status}</span>
										<span className="hdt-pill">{getDurationMs(selected)}ms</span>
										{selected.status === 'success' ? <span className="hdt-pill">{selected.result.source}</span> : null}
									</div>
									<div className="hdt-tabs">
										<TabButton active={detailTab === 'variables'} onClick={() => setDetailTab('variables')}>
											Variables
										</TabButton>
										<TabButton active={detailTab === 'data'} onClick={() => setDetailTab('data')}>
											Data
										</TabButton>
										<TabButton active={detailTab === 'errors'} onClick={() => setDetailTab('errors')}>
											Errors
										</TabButton>
									</div>

									{detailTab === 'variables' ? <Section title="Variables" value={selected.ctx.variables} /> : null}
									{detailTab === 'data' ? <Section title="Data" value={selected.status === 'success' ? selected.result.data : null} /> : null}
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
				<button className="hdt-trigger" onClick={() => setOpen(true)}>
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
		<button className={`hdt-tab ${active ? 'hdt-tab--active' : ''}`} onClick={onClick}>
			{children}
		</button>
	)
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
	return (
		<div className="hdt-section">
			<div className="hdt-section-title">{title}</div>
			<pre className="hdt-pre">{JSON.stringify(value ?? null, null, 2)}</pre>
		</div>
	)
}
