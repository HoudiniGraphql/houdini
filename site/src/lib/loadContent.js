import { loadOutline } from './loadOutline.js'
import fs from 'fs/promises'
import { compile } from 'mdsvex'
import { parse, HTMLElement } from 'node-html-parser'
import path from 'path'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'

// grab the list of files
export async function loadContent() {
	const content = await loadOutline()

	// loadContent is supposed to return a flat list of the doc site content so we can
	// index it on the client for a simple search mechanism
	return (
		await Promise.all(
			Object.entries(content).flatMap(([sectionName, section]) =>
				section.files.flatMap(async (file) => {
					// dont index the intro
					if (file.name === 'intro') {
						return []
					}

					// split the file up into multiple passages (text separated between headers)
					const passages = []

					// read the file contents
					const contents = await fs.readFile(file.filepath, 'utf-8')

					// compile the mdsvex content to get HTML out
					const { code } = await compile(contents, {
						rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings]
					})

					// parse the html contents so we can extract the various headers
					const parsed = parse(code)

					// walk through the whole file separated by headers so we can track the running breadcrumb
					let breadcrumb = []
					let content = ''
					let parentHeader = 0
					for (const tag of parsed.querySelectorAll('h1, h2, h3, p')) {
						// if we ran into text, just add the content
						if (!tag.tagName.startsWith('H')) {
							// add the tag content to the running counter
							content += tag.text + ' '

							// we're done
							continue
						}

						// we ran into a header after accumulating content, we need to add a passage
						// with everything we've been building up since now
						if (content) {
							const passage = {
								breadcrumb: [
									sectionName[0].toLocaleUpperCase() + sectionName.slice(1),
									...breadcrumb.map((ele) => ele.text || ele)
								],
								content: content.replace(/\n/g, ' '),
								href: file.slug
							}

							// if the content is nested under a header make sure we include the id link
							if (breadcrumb.length > 1) {
								passage.href += `#${breadcrumb[breadcrumb.length - 1].attributes.id}`
							}

							passages.push(passage)

							// reset the content accumulator
							content = ''
						}

						// an h1 marks the top of the breadcrumb
						if (tag.tagName === 'H1') {
							parentHeader = 1
							breadcrumb = [tag]
						}

						// if we ran into an h2, the breadcrumb needs to
						else if (tag.tagName === 'H2') {
							parentHeader = 2
							// the only thing underneath the breadcrumb so far is the
							// name of the header element (reset incase an h3 did something weird)
							breadcrumb = [breadcrumb[0], tag]
						}
						// if we run into an h3, we have to be careful
						else if (tag.tagName === 'H3') {
							parentHeader = 3

							// fake h2 under an h1
							if (parentHeader === 1) {
								breadcrumb = [breadcrumb[0], tag]
							}

							// if we are under an h2, replace the last element, don't push to the array
							if (parentHeader === 2) {
								breadcrumb = [breadcrumb[0], breadcrumb[1], tag]
							}
						}
					}

					// if there's content at the end we need to include it

					// return the list of passages for every file in the docs
					return passages
				})
			)
		)
	).flat()
}
