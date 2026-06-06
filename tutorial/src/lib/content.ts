import { readFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { createServerFn } from '@tanstack/react-start'
import glob from 'tiny-glob'
import type { TutorialManifest } from './types'

const CONTENT_ROOT = resolve(process.cwd(), 'content/the-basics')

async function readFiles(dir: string): Promise<Record<string, string>> {
	try {
		const paths = await glob('**/*', { cwd: dir, filesOnly: true })
		const entries = await Promise.all(
			paths.map(async (p) => [p, await readFile(resolve(dir, p), 'utf-8')] as const)
		)
		return Object.fromEntries(entries)
	} catch {
		return {}
	}
}

export const getContent = createServerFn({ method: 'GET' }).handler(async (): Promise<TutorialManifest> => {
	const meta = JSON.parse(await readFile(resolve(CONTENT_ROOT, 'meta.json'), 'utf-8'))

	const stepMdPaths = (await glob('chapters/*/*/index.md', { cwd: CONTENT_ROOT })).sort()

	const steps = await Promise.all(
		stepMdPaths.map(async (mdPath) => {
			const [, chapterSlug, stepSlug] = mdPath.split('/')
			const stepPath = resolve(CONTENT_ROOT, 'chapters', chapterSlug, stepSlug)

			const markdown = await readFile(resolve(stepPath, 'index.md'), 'utf-8')

			let stepMeta: { remove?: string[]; title?: string } = {}
			try {
				stepMeta = JSON.parse(await readFile(resolve(stepPath, 'meta.json'), 'utf-8'))
			} catch {}

			const files = await readFiles(resolve(stepPath, 'before'))
			const after = await readFiles(resolve(stepPath, 'after'))

			return {
				chapterSlug,
				step: {
					title: stepMeta.title ?? stepSlug.replace(/^\d+-/, '').replace(/-/g, ' '),
					slug: stepSlug,
					path: `${chapterSlug}/${stepSlug}`,
					markdown,
					files,
					solution: Object.keys(after).length > 0 ? after : null,
					remove: stepMeta.remove ?? [],
				},
			}
		})
	)

	const chapterMap = new Map<string, (typeof steps)[number]['step'][]>()
	for (const { chapterSlug, step } of steps) {
		if (!chapterMap.has(chapterSlug)) chapterMap.set(chapterSlug, [])
		chapterMap.get(chapterSlug)!.push(step)
	}

	const chapters = await Promise.all(
		[...chapterMap.entries()].map(async ([chapterSlug, chapterSteps]) => {
			let chapterMeta: { title?: string; openDirs?: string[] } = {}
			try {
				chapterMeta = JSON.parse(
					await readFile(resolve(CONTENT_ROOT, 'chapters', chapterSlug, 'meta.json'), 'utf-8')
				)
			} catch {}
			return {
				title: chapterMeta.title ?? chapterSlug.replace(/^\d+-/, '').replace(/-/g, ' '),
				slug: chapterSlug,
				openDirs: chapterMeta.openDirs ?? [],
				steps: chapterSteps,
			}
		})
	)

	return {
		id: basename(CONTENT_ROOT),
		title: meta.title,
		commands: meta.commands,
		chapters,
		applyOrder: meta.applyOrder,
		completionSignal: meta.completionSignal,
	}
})
