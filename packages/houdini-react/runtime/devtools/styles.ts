const styles = `.hdt {
	--hdt-bg: #101113;
	--hdt-panel: #17191c;
	--hdt-header: #1f252c;
	--hdt-raised: #171d26;
	--hdt-text: #f4f7fb;
	--hdt-muted: #a8b3c2;
	--hdt-dim: #6f7b8a;
	--hdt-line: #2a3038;
	--hdt-blue: #7fb4ff;
	--hdt-blue-bg: rgba(127, 180, 255, 0.13);
	--hdt-ok: #7db65d;
	--hdt-warn: #d7b45a;
	--hdt-error: #ff6b58;

	position: fixed;
	z-index: 999999;
	font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	font-size: 13px;
	line-height: 1.4;
	color: var(--hdt-text);
}

.hdt,
.hdt * {
	box-sizing: border-box;
}

.hdt button,
.hdt button:hover,
.hdt button:focus,
.hdt button:focus-visible,
.hdt button:active {
	appearance: none !important;
	-webkit-appearance: none !important;
	margin: 0 !important;
	font: inherit !important;
	line-height: inherit !important;
	letter-spacing: inherit !important;
	text-align: inherit !important;
	text-decoration: none !important;
	text-transform: none !important;
	transform: none !important;
	transition: none !important;
	animation: none !important;
	outline: none !important;
	box-shadow: none !important;
}

.hdt--open { left: 0; right: 0; bottom: 0; }
.hdt--closed { right: 16px; bottom: 16px; }

.hdt-panel {
	width: 100vw;
	height: 64vh;
	min-height: 390px;
	background: var(--hdt-bg);
	border-top: 1px solid var(--hdt-line);
	box-shadow: 0 -18px 48px rgba(0, 0, 0, 0.38);
	overflow: hidden;
}

.hdt-header {
	height: 44px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 14px;
	background: var(--hdt-header);
	border-bottom: 1px solid var(--hdt-line);
}

.hdt-title,
.hdt-actions,
.hdt-row-title,
.hdt-detail-header,
.hdt-heading-row,
.hdt-summary,
.hdt-trigger {
	display: flex;
	align-items: center;
}

.hdt-title {
	gap: 8px;
	font-weight: 700;
	color: var(--hdt-text) !important;
}

.hdt-title strong { color: var(--hdt-text) !important; }
.hdt-count,
.hdt-row-meta,
.hdt-muted { color: var(--hdt-muted) !important; }
.hdt-actions { gap: 8px; }

.hdt-button {
	padding: 5px 10px !important;
	border: 1px solid var(--hdt-line) !important;
	border-radius: 6px !important;
	background: #15191f !important;
	color: var(--hdt-text) !important;
	cursor: pointer !important;
}

.hdt-button:hover {
	background: var(--hdt-blue-bg) !important;
	border-color: rgba(127, 180, 255, 0.38) !important;
}

.hdt-body {
	display: grid;
	grid-template-columns: 400px 1fr;
	height: calc(100% - 44px);
	min-height: 0;
}

.hdt-list,
.hdt-detail {
	overflow: auto;
	min-height: 0;
}

.hdt-list {
	background: var(--hdt-panel);
	border-right: 1px solid var(--hdt-line);
}

.hdt-row {
	position: relative;
	width: 100%;
	padding: 10px 14px 10px 18px !important;
	border: 0 !important;
	border-bottom: 1px solid var(--hdt-line) !important;
	border-radius: 0 !important;
	background: transparent !important;
	color: var(--hdt-text) !important;
	cursor: pointer !important;
}

.hdt-row::before {
	content: "";
	position: absolute;
	left: 0;
	top: 0;
	bottom: 0;
	width: 3px;
	background: transparent;
}

.hdt-row:hover {
	background: rgba(127, 180, 255, 0.06) !important;
}

.hdt-row--selected {
	background: var(--hdt-blue-bg) !important;
}

.hdt-row--selected::before {
	background: var(--hdt-blue);
}

.hdt-row-title {
	gap: 8px;
	min-width: 0;
	font-size: 13px;
	font-weight: 650;
	color: var(--hdt-text);
}

.hdt-name {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.hdt-row-kind {
	flex: 0 0 auto;
	margin-left: auto;
	color: var(--hdt-dim);
	font-size: 11px;
	font-weight: 650;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.hdt-row-meta {
	margin-top: 3px;
	padding-left: 16px;
	font-size: 12px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.hdt-detail {
	padding: 20px 24px 28px;
	background: var(--hdt-bg);
}

.hdt-detail-header {
	justify-content: space-between;
	gap: 16px;
	margin: 0 0 18px;
}

.hdt-heading-row {
	gap: 10px;
	min-width: 0;
}

.hdt-heading {
	min-width: 0;
	margin: 0;
	font-size: 22px;
	line-height: 1.15;
	font-weight: 700;
	color: var(--hdt-text);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.hdt-summary {
	flex: 0 0 auto;
	justify-content: flex-end;
	gap: 8px;
	max-width: 52%;
	flex-wrap: wrap;
}

.hdt-summary-badge {
	flex: 0 0 auto;
	padding: 1px 6px;
	border: 1px solid var(--hdt-line);
	border-radius: 4px;
	background: rgba(255, 255, 255, 0.03);
	color: var(--hdt-muted);
	font-size: 11px;
	font-weight: 700;
	line-height: 1.5;
}

.hdt-tabs {
	display: flex;
	gap: 22px;
	margin-bottom: 18px;
	border-bottom: 1px solid var(--hdt-line);
}

.hdt-tab {
	padding: 0 0 9px !important;
	border: 0 !important;
	border-bottom: 2px solid transparent !important;
	border-radius: 0 !important;
	background: transparent !important;
	color: var(--hdt-muted) !important;
	font-size: 13px !important;
	font-weight: 650 !important;
	cursor: pointer !important;
}

.hdt-tab:hover {
	color: var(--hdt-text) !important;
	background: transparent !important;
}

.hdt-tab--active,
.hdt-tab--active:hover {
	color: var(--hdt-text) !important;
	border-bottom-color: var(--hdt-blue) !important;
	background: transparent !important;
}

.hdt-section { margin-bottom: 14px; }

.hdt-section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 10px;
}

.hdt-section-title {
	font-size: 14px;
	font-weight: 650;
	color: var(--hdt-text);
}

.hdt-copy {
	padding: 3px 8px !important;
	border: 1px solid var(--hdt-line) !important;
	border-radius: 4px !important;
	background: transparent !important;
	color: var(--hdt-muted) !important;
	font-size: 12px !important;
	cursor: pointer !important;
}

.hdt-copy:hover {
	background: var(--hdt-blue-bg) !important;
	color: var(--hdt-text) !important;
}

.hdt-pre {
	margin: 0;
	padding: 12px;
	border: 1px solid var(--hdt-line);
	border-radius: 4px;
	background: var(--hdt-raised);
	color: var(--hdt-text);
	overflow: auto;
	font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Monaco, monospace;
	font-size: 12px;
	line-height: 1.55;
}


.hdt-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--hdt-ok);
	flex: 0 0 auto;
}

.hdt-dot--pending { background: var(--hdt-warn); }
.hdt-dot--error { background: var(--hdt-error); }

.hdt-trigger,
.hdt-trigger:hover,
.hdt-trigger:focus,
.hdt-trigger:active {
	gap: 10px;
	padding: 10px 12px !important;
	border: 1px solid rgba(255, 255, 255, 0.1) !important;
	border-radius: 999px !important;
	background: var(--hdt-header) !important;
	color: var(--hdt-text) !important;
	cursor: pointer !important;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35) !important;
}

.hdt-trigger * {
	color: inherit !important;
}
`

export default styles
