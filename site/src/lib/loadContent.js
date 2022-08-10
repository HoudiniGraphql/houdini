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
			Object.keys(content).flatMap((which) =>
				Object.keys(content[which]).flatMap((section) => {
					return content[which][section].files.flatMap(async (file) => {
						// dont index the intro
						if (section === 'intro') {
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
						for (const tag of parsed.querySelectorAll('headerwithmode, h1, h2, h3, p')) {
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
										section[0].toLocaleUpperCase() + section.slice(1),
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
							// a HEADERWITHMODE is a custom element that acts like an h1
							else if (tag.tagName === 'HEADERWITHMODE') {
								parentHeader = 1

								// figure out the dynamic title
								const title = tag.attributes.title
								const inline = file.filepath.endsWith('inline.svx')
								breadcrumb = [inline ? `Inline ${title}` : `${title} Store`]
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
				})
			)
		)
	).flat()
}

// grab the list of files
export async function loadContentOld() {
	// the root directory
	const routeDir = path.resolve('src', 'routes')

	// build up an object from every directory in the routeDir
	return (
		await Promise.all(
			(await fs.readdir(routeDir)).map(async (category) => {
				if (category === 'intro') {
					return []
				}

				const categoryDir = path.join(routeDir, category)
				// if the path is not a directory, ignore it
				if (!(await fs.lstat(categoryDir)).isDirectory()) {
					return []
				}

				const passages = []

				// look at every file in the category directory
				for (const file of await fs.readdir(categoryDir)) {
					// the file's path
					const filepath = path.join(categoryDir, file)

					// open the contents of the file so we can extract the frontmatter
					const contents = await fs.readFile(filepath, 'utf-8')
					const { code } = await compile(contents, {
						rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings]
					})

					// parse the contents so we can extract the various headers
					const parsed = parse(code)

					// walk through all of the contents in order of appearance and split every section of paragraphs into
					// its own document with a breadcrumb of the running headers
					let breadcrumb = []
					let content = ''
					let headerLevel = 0
					for (const tag of parsed.querySelectorAll('h1, h2, h3, p')) {
						// if we ran into a header and there is a content accumulator, add what we have to the list
						if (tag.tagName.startsWith('H') && content) {
							const passage = {
								breadcrumb: [
									category[0].toUpperCase() + category.slice(1),
									...breadcrumb.map((element) => element.text)
								],
								content: content.replace(/\n/g, ' '),
								href: `/${category}/${path.basename(file).split('.').slice(0, -1).join('.')}`
							}

							// if the content is nested under a header
							if (breadcrumb.length > 1) {
								passage.href += `#${breadcrumb[breadcrumb.length - 1].attributes.id}`
							}

							passages.push(passage)

							content = ''
						}

						if (tag.tagName === 'H2') {
							// there are only two entries in the breadcrumb
							breadcrumb = [tag]
							headerLevel = 2
						}

						if (tag.tagName === 'H3') {
							// if an h3 is inside of an h1, just use that as the breadcrumb
							if (headerLevel === 1) {
								breadcrumb = [tag]
							}

							if (headerLevel === 2) {
								breadcrumb = [breadcrumb[0], tag]
							}
						}

						if (tag.tagName === 'P') {
						}
					}

					if (content) {
						const passage = {
							breadcrumb: [
								category[0].toUpperCase() + category.slice(1),
								...breadcrumb.map((element) => element.text)
							],
							content: content.replace(/\n/g, ' '),
							href: `/${category}/${path.basename(file).split('.')[0]}`
						}

						// if the content is nested under a header
						if (breadcrumb.length > 1) {
							passage.href += `#${breadcrumb[breadcrumb.length - 1].attributes.id}`
						}

						passages.push(passage)

						content = ''
					}
				}

				return passages
			})
		)
	).flat()
}
