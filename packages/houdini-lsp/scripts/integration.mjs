// Scripted LSP session against e2e/react to exercise the houdini-lsp server end to end.
import { spawn } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { fileURLToPath } from 'node:url'
const REPO = fileURLToPath(new URL('../../..', import.meta.url))
const ROOT = `${REPO}/e2e/react`
const SERVER = `${REPO}/packages/houdini-lsp/build/index.js`

const proc = spawn('node', [SERVER, '--stdio'], { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] })

let nextId = 1
const pending = new Map()
const logs = []
const diagnostics = new Map() // uri -> latest diagnostics

// ── framing ───────────────────────────────────────────────────────────────────
let buffer = Buffer.alloc(0)
proc.stdout.on('data', (chunk) => {
	buffer = Buffer.concat([buffer, chunk])
	while (true) {
		const headerEnd = buffer.indexOf('\r\n\r\n')
		if (headerEnd === -1) return
		const header = buffer.slice(0, headerEnd).toString()
		const length = parseInt(/Content-Length: (\d+)/.exec(header)?.[1] ?? '0', 10)
		if (buffer.length < headerEnd + 4 + length) return
		const body = buffer.slice(headerEnd + 4, headerEnd + 4 + length).toString()
		buffer = buffer.slice(headerEnd + 4 + length)
		handle(JSON.parse(body))
	}
})

function handle(msg) {
	if (msg.id !== undefined && pending.has(msg.id)) {
		const { resolve } = pending.get(msg.id)
		pending.delete(msg.id)
		resolve(msg)
	} else if (msg.method === 'window/logMessage') {
		logs.push(msg.params.message)
		console.log(`  [server] ${msg.params.message}`)
	} else if (msg.method === 'textDocument/publishDiagnostics') {
		diagnostics.set(msg.params.uri, msg.params.diagnostics)
		if (process.env.DEBUG_DIAGS) {
			console.log(`  [diags] ${msg.params.uri.split('/').slice(-2).join('/')} → ${JSON.stringify(msg.params.diagnostics.map((d) => d.message.slice(0, 80)))}`)
		}
	}
}

function send(msg) {
	const body = JSON.stringify(msg)
	proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
}

function request(method, params) {
	const id = nextId++
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve })
		setTimeout(() => {
			if (pending.has(id)) {
				pending.delete(id)
				reject(new Error(`timeout waiting for ${method}`))
			}
		}, 30_000)
		send({ jsonrpc: '2.0', id, method, params })
	})
}
const notify = (method, params) => send({ jsonrpc: '2.0', method, params })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(cond, ms, what) {
	const start = Date.now()
	while (Date.now() - start < ms) {
		if (cond()) return
		await sleep(200)
	}
	throw new Error(`timeout waiting for ${what}`)
}

let failures = 0
function check(name, cond, detail) {
	if (cond) console.log(`ok   ${name}`)
	else {
		failures++
		console.log(`FAIL ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)?.slice(0, 400)}` : ''}`)
	}
}

const uri = (p) => pathToFileURL(`${ROOT}/${p}`).toString()
const open = (path, text, languageId) =>
	notify('textDocument/didOpen', {
		textDocument: { uri: uri(path), languageId, version: 1, text },
	})

// ── session ───────────────────────────────────────────────────────────────────
try {
	await request('initialize', {
		processId: process.pid,
		rootUri: pathToFileURL(ROOT).toString(),
		capabilities: {},
	})
	notify('initialized', {})

	console.log('waiting for pipeline...')
	await waitFor(() => logs.some((l) => l.includes('[houdini-lsp] ready')), 120_000, 'ready')
	check('server ready', true)

	// ── A: inline .tsx document — live validation of the real file is clean ──
	const tsxPath = 'src/routes/list-id/+page.tsx'
	const tsxText = readFileSync(`${ROOT}/${tsxPath}`, 'utf-8')
	open(tsxPath, tsxText, 'typescriptreact')
	await sleep(4000) // both passes: fast rules + pipeline overlay
	check(
		'clean tsx has no live diagnostics',
		(diagnostics.get(uri(tsxPath)) ?? []).length === 0,
		diagnostics.get(uri(tsxPath))
	)

	// locate the inline mutation pieces
	const lines = tsxText.split('\n')
	const spreadLine = lines.findIndex((l) => l.includes('...ListID_Users_insert'))
	const spreadCol = lines[spreadLine].indexOf('...ListID_Users_insert')

	// ── B: field completions inside the inline template (start of the spread's
	// line, before the ... token, is plain selection-set whitespace) ──
	const fieldComp = await request('textDocument/completion', {
		textDocument: { uri: uri(tsxPath) },
		position: { line: spreadLine, character: 0 },
	})
	const fieldLabels = (fieldComp.result ?? []).map((i) => i.label)
	check(
		'field completions inside inline template',
		fieldLabels.includes('id') && fieldLabels.includes('name'),
		fieldLabels.slice(0, 15)
	)
	check(
		'component fields complete as fields',
		fieldLabels.includes('Avatar') && fieldLabels.includes('CF_A_UserAvatar'),
		fieldLabels
	)

	// ── B2: required arguments sort before optional ones ──
	const argsDoc = 'mutation ArgsLSP {\n\taddUser(\n}\n'
	const argsPath = 'src/routes/args-scratch.gql'
	open(argsPath, argsDoc, 'graphql')
	const argsComp = await request('textDocument/completion', {
		textDocument: { uri: uri(argsPath) },
		position: { line: 1, character: '\taddUser('.length },
	})
	const argItems = argsComp.result ?? []
	const sortOf = (label) => argItems.find((i) => i.label === label)?.sortText ?? ''
	check(
		'required args sort before optional args',
		sortOf('name').startsWith('0') &&
			sortOf('birthDate').startsWith('0') &&
			sortOf('delay').startsWith('1') &&
			sortOf('enumValue').startsWith('1'),
		argItems.map((i) => ({ l: i.label, s: i.sortText }))
	)

	// ── C: fragment spread completions include generated list operations ──
	const spreadComp = await request('textDocument/completion', {
		textDocument: { uri: uri(tsxPath) },
		position: { line: spreadLine, character: spreadCol + 3 },
	})
	const spreadLabels = (spreadComp.result ?? []).map((i) => i.label)
	check(
		'spread completions include list operation fragments',
		spreadLabels.some((l) => l.endsWith('_insert')),
		spreadLabels.slice(0, 15)
	)
	check(
		'spread completions hide generated __ fragments',
		!spreadLabels.some((l) => l.startsWith('__')),
		spreadLabels.filter((l) => l.startsWith('__'))
	)

	// ── D: hover on a field in the inline template ──
	const mutLine = lines.findIndex((l) => l.includes('addUser(snapshot:'))
	const hover = await request('textDocument/hover', {
		textDocument: { uri: uri(tsxPath) },
		position: { line: mutLine, character: lines[mutLine].indexOf('addUser') + 2 },
	})
	check(
		'hover inside inline template',
		JSON.stringify(hover.result?.contents ?? '').includes('addUser'),
		hover.result
	)

	// ── E: go-to-definition on the list operation spread ──
	const def = await request('textDocument/definition', {
		textDocument: { uri: uri(tsxPath) },
		position: { line: spreadLine, character: spreadCol + 10 },
	})
	check(
		'definition on list operation spread resolves',
		typeof def.result?.uri === 'string' && def.result.uri.startsWith('file://'),
		def.result
	)
	if (def.result?.uri) console.log(`  definition → ${def.result.uri.replace(ROOT, '')}:${def.result.range.start.line}`)

	// ── F: live diagnostics — typo in a .gql without saving (pipeline overlay) ──
	const gqlPath = 'src/routes/hello-world/+page.gql'
	const overlayStart = Date.now()
	open(gqlPath, 'query HelloWorldLSP {\n\thellox\n}\n', 'graphql')
	try {
		await waitFor(
			() => (diagnostics.get(uri(gqlPath)) ?? []).some((d) => d.message.includes('hellox')),
			15_000,
			'overlay diagnostic'
		)
		check('unknown field flagged live (no save)', true)
		console.log(`  overlay latency (incl. 250ms debounce): ~${Date.now() - overlayStart}ms`)
	} catch (err) {
		check('unknown field flagged live (no save)', false, diagnostics.get(uri(gqlPath)))
	}
	const gqlDiags = diagnostics.get(uri(gqlPath)) ?? []
	check(
		'live diagnostic anchored on the field',
		gqlDiags[0]?.range.start.line === 1,
		gqlDiags[0]?.range
	)
	check(
		'diagnostic range covers the whole identifier',
		gqlDiags[0]?.range.end.character - gqlDiags[0]?.range.start.character === 'hellox'.length,
		gqlDiags[0]?.range
	)

	// fix it → diagnostics clear
	notify('textDocument/didChange', {
		textDocument: { uri: uri(gqlPath), version: 2 },
		contentChanges: [{ text: 'query HelloWorldLSP {\n\thello\n}\n' }],
	})
	await waitFor(
		() => (diagnostics.get(uri(gqlPath)) ?? []).length === 0,
		15_000,
		'diagnostics to clear'
	).catch(() => {})
	check('fixed document clears live diagnostics', (diagnostics.get(uri(gqlPath)) ?? []).length === 0, diagnostics.get(uri(gqlPath)))

	// ── F2: unknown fragment spread flagged live (pipeline overlay) ──
	const fooPath = 'src/routes/foo-scratch.gql'
	open(fooPath, 'query FooLSP {\n\tuser(id: "1", snapshot: "x") {\n\t\t...Foo\n\t}\n}\n', 'graphql')
	try {
		await waitFor(
			() => (diagnostics.get(uri(fooPath)) ?? []).some((d) => d.message.includes('Foo')),
			15_000,
			'unknown fragment diagnostic'
		)
		check('unknown fragment spread flagged live', true)
	} catch {
		check('unknown fragment spread flagged live', false, diagnostics.get(uri(fooPath)))
	}

	// ── F3: a fragment defined in another block of the same buffer is known ──
	const twoBlockPath = 'src/routes/twoblocks-scratch.tsx'
	open(
		twoBlockPath,
		[
			`import { graphql } from '$houdini'`,
			'const frag = graphql(`',
			'\tfragment TwoBlocksLocal on User {',
			'\t\tname',
			'\t}',
			'`)',
			'const query = graphql(`',
			'\tquery TwoBlocksQuery {',
			'\t\tuser(id: "1", snapshot: "x") {',
			'\t\t\t...TwoBlocksLocal',
			'\t\t}',
			'\t}',
			'`)',
			'',
		].join('\n'),
		'typescriptreact'
	)
	await sleep(4000)
	check(
		'fragment defined in a sibling block resolves',
		(diagnostics.get(uri(twoBlockPath)) ?? []).length === 0,
		diagnostics.get(uri(twoBlockPath))
	)

	// ── F4: diagnostics inside an inline graphql() template map to host lines ──
	const inlinePath = 'src/routes/inline-diag-scratch.tsx'
	open(
		inlinePath,
		[
			`import { graphql } from '$houdini'`,
			'const q = graphql(`',
			'\tquery InlineDiagLSP {',
			'\t\thellox',
			'\t}',
			'`)',
			'',
		].join('\n'),
		'typescriptreact'
	)
	try {
		await waitFor(
			() => (diagnostics.get(uri(inlinePath)) ?? []).some((d) => d.message.includes('hellox')),
			15_000,
			'inline template diagnostic'
		)
		const inlineDiag = (diagnostics.get(uri(inlinePath)) ?? []).find((d) =>
			d.message.includes('hellox')
		)
		check(
			'inline graphql() diagnostic lands on the host line',
			inlineDiag?.range.start.line === 3 &&
				inlineDiag?.range.end.character - inlineDiag?.range.start.character ===
					'hellox'.length,
			inlineDiag?.range
		)
	} catch {
		check('inline graphql() diagnostic lands on the host line', false, diagnostics.get(uri(inlinePath)))
	}

	// ── G: houdini patterns produce no false positives live ──
	const refetchPath = 'src/routes/refetchable-fragment/+page.gql'
	open(refetchPath, readFileSync(`${ROOT}/${refetchPath}`, 'utf-8'), 'graphql')
	await sleep(800)
	check(
		'@with spread + fragment file has no false positives',
		(diagnostics.get(uri(refetchPath)) ?? []).length === 0,
		diagnostics.get(uri(refetchPath))
	)

	// ── H: @with completions (per-spread fragment arguments, the #1576 fix) ──
	const refetchText = readFileSync(`${ROOT}/${refetchPath}`, 'utf-8')
	const rLines = refetchText.split('\n')
	const withLine = rLines.findIndex((l) => l.includes('@with('))
	const withCol = rLines[withLine].indexOf('@with(') + '@with('.length
	const withComp = await request('textDocument/completion', {
		textDocument: { uri: uri(refetchPath) },
		position: { line: withLine, character: withCol },
	})
	const withLabels = (withComp.result ?? []).map((i) => i.label)
	check(
		'@with completions list the fragment arguments',
		withLabels.includes('size') && withLabels.includes('param'),
		withLabels.slice(0, 15)
	)
	// ── I: @when completions on a list operation spread use the list field's args ──
	const whenDoc = 'mutation WhenLSP {\n\taddUser(snapshot: "x", name: "y", birthDate: 1) {\n\t\t...OptimisticKeyTest_insert @when(f: 1)\n\t}\n}\n'
	const whenPath = 'src/routes/when-scratch.gql'
	open(whenPath, whenDoc, 'graphql')
	const whenCol = whenDoc.split('\n')[2].indexOf('@when(') + '@when('.length
	const whenComp = await request('textDocument/completion', {
		textDocument: { uri: uri(whenPath) },
		position: { line: 2, character: whenCol },
	})
	const whenLabels = (whenComp.result ?? []).map((i) => i.label)
	check(
		'@when completions are the list field arguments',
		whenLabels.includes('snapshot') && whenLabels.length >= 3 && !whenLabels.includes('avatarURL'),
		whenLabels
	)

	// ── H2: unknown @with argument flagged live (no save) ──
	const badWithPath = 'src/routes/badwith-scratch.gql'
	open(
		badWithPath,
		'query BadWithLSP {\n\tuser(id: "1", snapshot: "x") {\n\t\t...RefetchableUserInfo @with(foo: "bar")\n\t}\n}\n',
		'graphql'
	)
	await sleep(800)
	const badWithDiags = diagnostics.get(uri(badWithPath)) ?? []
	check(
		'unknown @with argument flagged live',
		badWithDiags.some((d) => d.message.includes('"foo"')),
		badWithDiags
	)

	// ── H3: @with argument literal type-checked live ──
	const badTypePath = 'src/routes/badtype-scratch.gql'
	open(
		badTypePath,
		'query BadTypeLSP {\n\tuser(id: "1", snapshot: "x") {\n\t\t...RefetchableUserInfo @with(param: "bar")\n\t}\n}\n',
		'graphql'
	)
	await sleep(800)
	const badTypeDiags = diagnostics.get(uri(badTypePath)) ?? []
	check(
		'wrong @with argument type flagged live',
		badTypeDiags.some((d) => d.message.includes('expected Boolean')),
		badTypeDiags
	)

	// ── I2: end-of-line cursors (the normal typing position) ──
	// field completion with the cursor at the end of a partial word
	const eolDoc = 'query EolLSP {\n\tus\n}\n'
	const eolPath = 'src/routes/eol-scratch.gql'
	open(eolPath, eolDoc, 'graphql')
	const eolComp = await request('textDocument/completion', {
		textDocument: { uri: uri(eolPath) },
		position: { line: 1, character: 3 },
	})
	const eolLabels = (eolComp.result ?? []).map((i) => i.label)
	check(
		'field completions at end of line while typing',
		eolLabels.includes('user') && !eolLabels.includes('fragment'),
		eolLabels.slice(0, 10)
	)

	// unclosed @when( at end of line — the screenshot scenario
	const unclosedDoc = 'mutation UnclosedLSP {\n\taddUser(snapshot: "x", name: "y", birthDate: 1) {\n\t\t...OptimisticKeyTest_insert @when(\n\t}\n}\n'
	const unclosedPath = 'src/routes/unclosed-scratch.gql'
	open(unclosedPath, unclosedDoc, 'graphql')
	const unclosedCol = unclosedDoc.split('\n')[2].length
	const unclosedComp = await request('textDocument/completion', {
		textDocument: { uri: uri(unclosedPath) },
		position: { line: 2, character: unclosedCol },
	})
	const unclosedLabels = (unclosedComp.result ?? []).map((i) => i.label)
	check(
		'@when completions with unclosed paren at end of line',
		unclosedLabels.includes('snapshot') && !unclosedLabels.includes('extend'),
		unclosedLabels.slice(0, 10)
	)

	// ── J: on-save pipeline diagnostics still work ──
	const helloOnDisk = `${ROOT}/src/routes/hello-world/+page.gql`
	
	const original = readFileSync(helloOnDisk, 'utf-8')
	try {
		writeFileSync(helloOnDisk, 'query HelloWorld {\n\thellox\n}\n')
		notify('textDocument/didSave', { textDocument: { uri: uri(gqlPath) } })
		await waitFor(
			() => (diagnostics.get(uri(gqlPath)) ?? []).some((d) => d.message.toLowerCase().includes('hellox')),
			60_000,
			'pipeline diagnostic after save'
		)
		check('pipeline diagnostic published on save', true)
	} catch (err) {
		check('pipeline diagnostic published on save', false, err.message)
	} finally {
		writeFileSync(helloOnDisk, original)
	}
	notify('textDocument/didSave', { textDocument: { uri: uri(gqlPath) } })
	try {
		await waitFor(
			() => (diagnostics.get(uri(gqlPath)) ?? []).length === 0,
			60_000,
			'pipeline diagnostics cleared after fixing'
		)
		check('pipeline diagnostics clear after fixed save', true)
	} catch (err) {
		check('pipeline diagnostics clear after fixed save', false, diagnostics.get(uri(gqlPath)))
	}

	// ── K: watched-file changes reconcile without any editor interaction ──
	const watchedPath = 'src/routes/watch-scratch.gql'
	const watchedOnDisk = `${ROOT}/${watchedPath}`
	try {
		writeFileSync(watchedOnDisk, 'query WatchLSP {\n\tnope\n}\n')
		notify('workspace/didChangeWatchedFiles', {
			changes: [{ uri: uri(watchedPath), type: 1 }],
		})
		await waitFor(
			() => (diagnostics.get(uri(watchedPath)) ?? []).some((d) => d.message.includes('nope')),
			60_000,
			'watched-file diagnostic'
		)
		check('watched file change validates without editor interaction', true)
	} catch (err) {
		check('watched file change validates without editor interaction', false, err.message)
	} finally {
		try {
			unlinkSync(watchedOnDisk)
		} catch {}
	}
	notify('workspace/didChangeWatchedFiles', {
		changes: [{ uri: uri(watchedPath), type: 3 }],
	})
	try {
		await waitFor(
			() => (diagnostics.get(uri(watchedPath)) ?? []).length === 0,
			60_000,
			'watched-file diagnostics cleared after deletion'
		)
		check('deleted watched file clears its diagnostics', true)
	} catch {
		check('deleted watched file clears its diagnostics', false, diagnostics.get(uri(watchedPath)))
	}

	// ── L: clean shutdown (no leaked pipeline processes) ──
	await request('shutdown', null)
	notify('exit', null)
	try {
		await waitFor(() => proc.exitCode !== null, 15_000, 'server exit')
		check('server exits cleanly on shutdown', proc.exitCode === 0, proc.exitCode)
	} catch {
		check('server exits cleanly on shutdown', false, 'still running')
	}
} catch (err) {
	failures++
	console.log(`FAIL (exception) ${err.message}`)
}

proc.kill()
process.exit(failures ? 1 : 0)
