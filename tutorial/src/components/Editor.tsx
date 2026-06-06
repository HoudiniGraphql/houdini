import { acceptCompletion } from '@codemirror/autocomplete'
import { indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'
import { useTutorial } from '../lib/state'

// VS Code Dark+ colors — matches GraphiQL's Monaco vs-dark base
const darkChrome = EditorView.theme({
	'&': { height: '100%', backgroundColor: 'var(--surface)' },
	'.cm-scroller': { overflow: 'auto' },
	'.cm-content': { caretColor: 'var(--fg)' },
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
	'.cm-gutters': {
		backgroundColor: 'var(--surface-raised)',
		color: 'var(--fg-subtle)',
		border: 'none',
		borderRight: '1px solid var(--edge)',
	},
	'.cm-activeLineGutter': { backgroundColor: 'transparent' },
	'.cm-activeLine': { backgroundColor: 'hsla(219, 29%, 78%, 0.05)' },
	'&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
		backgroundColor: 'hsla(338, 100%, 67%, 0.2)',
	},
	'.cm-tooltip': {
		backgroundColor: 'var(--surface-overlay)',
		border: '1px solid var(--edge)',
	},
	'.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
		backgroundColor: 'var(--surface-overlay)',
	},
}, { dark: true })

const darkSyntax = syntaxHighlighting(HighlightStyle.define([
	{ tag: [t.keyword, t.modifier], color: '#569cd6' },
	{ tag: [t.controlKeyword, t.operatorKeyword], color: '#c586c0' },
	{ tag: [t.definitionKeyword, t.moduleKeyword], color: '#569cd6' },
	{ tag: t.comment, color: '#6a9955', fontStyle: 'italic' },
	{ tag: [t.string, t.special(t.string), t.inserted], color: '#ce9178' },
	{ tag: t.regexp, color: '#d16969' },
	{ tag: [t.number, t.float, t.integer], color: '#b5cea8' },
	{ tag: [t.bool, t.null], color: '#569cd6' },
	{ tag: [t.className, t.typeName, t.namespace], color: '#4ec9b0' },
	{ tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#dcdcaa' },
	{ tag: t.propertyName, color: '#9cdcfe' },
	{ tag: [t.variableName, t.self], color: '#9cdcfe' },
	{ tag: t.labelName, color: '#9cdcfe' },
	{ tag: [t.operator, t.punctuation, t.separator], color: '#d4d4d4' },
	{ tag: t.angleBracket, color: '#808080' },
	{ tag: t.tagName, color: '#569cd6' },
	{ tag: t.attributeName, color: '#9cdcfe' },
	{ tag: t.invalid, color: '#f44747' },
]))

const lightChrome = EditorView.theme({
	'&': { height: '100%' },
	'.cm-scroller': { overflow: 'auto' },
})

const themeCompartment = new Compartment()

const baseExtensions = [
	basicSetup,
	EditorState.tabSize.of(2),
	keymap.of([{ key: 'Tab', run: acceptCompletion }, indentWithTab]),
	indentUnit.of('\t'),
]

function extensionsForFile(name: string) {
	if (name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.jsx')) {
		return [javascript({ jsx: true, typescript: true })]
	}
	return []
}

function themeExtensions(dark: boolean) {
	return dark ? [darkChrome, darkSyntax] : [lightChrome]
}

export function Editor({ dark }: { dark?: boolean }) {
	const { files, selectedFile, updateFile } = useTutorial()
	const containerRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<EditorView | null>(null)
	const statesRef = useRef<Map<string, EditorState>>(new Map())
	const skipRef = useRef(false)
	const selectedFileRef = useRef(selectedFile)
	const updateFileRef = useRef(updateFile)
	const darkRef = useRef(dark)
	selectedFileRef.current = selectedFile
	updateFileRef.current = updateFile
	darkRef.current = dark

	useEffect(() => {
		if (!viewRef.current) return
		viewRef.current.dispatch({
			effects: themeCompartment.reconfigure(themeExtensions(!!dark)),
		})
	}, [dark])

	useEffect(() => {
		if (!containerRef.current) return

		const view = new EditorView({
			parent: containerRef.current,
			state: EditorState.create({
				extensions: [
					...baseExtensions,
					themeCompartment.of(themeExtensions(!!darkRef.current)),
				],
			}),
			dispatch(tr) {
				view.update([tr])
				if (tr.docChanged && !skipRef.current) {
					const name = selectedFileRef.current
					if (name) {
						updateFileRef.current(name, view.state.doc.toString())
						statesRef.current.set(name, view.state)
					}
				}
			},
		})

		viewRef.current = view
		return () => view.destroy()
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		const view = viewRef.current
		if (!view) return
		skipRef.current = true

		for (const [name, contents] of Object.entries(files)) {
			const existing = statesRef.current.get(name)
			if (existing) {
				const currentContents = existing.doc.toString()
				if (currentContents !== contents) {
					const updated = existing.update({ changes: { from: 0, to: currentContents.length, insert: contents } })
					statesRef.current.set(name, updated.state)
					if (name === selectedFile) view.setState(updated.state)
				}
			} else {
				const state = EditorState.create({
					doc: contents,
					extensions: [
						...baseExtensions,
						...extensionsForFile(name),
						themeCompartment.of(themeExtensions(!!darkRef.current)),
					],
				})
				statesRef.current.set(name, state)
				if (name === selectedFile) view.setState(state)
			}
		}

		skipRef.current = false
	}, [files, selectedFile])

	useEffect(() => {
		const view = viewRef.current
		if (!view || !selectedFile) return

		const state = statesRef.current.get(selectedFile)
		if (state) view.setState(state)
	}, [selectedFile])

	return <div ref={containerRef} className="h-full" />
}
