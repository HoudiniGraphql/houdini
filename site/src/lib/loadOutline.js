import fs from 'fs/promises'
import { compile } from 'mdsvex'
import { parse } from 'node-html-parser'
import path from 'path'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'

async function extractInfo(filepath, category, child) {
	// open the contents of the file so we can extract the frontmatter
	const contents = await fs.readFile(filepath, 'utf-8')
	const { data, code } = await compile(contents, {
		rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings]
	})
	/** @type { { [key: string]: any }} */
	const metadata = data.fm
	if (!metadata || (typeof metadata.sidebar === 'boolean' && !metadata.sidebar)) {
		if (!metadata) {
			console.log('invalid frontmatter:', filepath)
		}
		return null
	}

	// parse the contents so we can extract the various headers
	const parsed = parse(code)

	// every h2 gets an entry in the timeline
	const subcategories = parsed
		.querySelectorAll('h2')
		.map((h2) => ({
			text: h2.text,
			id: h2.attributes.id
		}))
		.filter((subcat) => !subcat.text.toLowerCase().endsWith('s next?'))

	return {
		title: metadata.title,
		slug: child ? `/${category}/${child}` : `/${category}`,
		filepath,
		subcategories
	}
}

// grab the list of files
export async function loadOutline() {
	// the root directory
	const routeDir = path.resolve('src', 'routes')

	// we need to build up an outline of all of the documents
	// the api sections for documents are directories with an inline or store file

	// build up an object from every directory in the routeDir
	const content = Object.fromEntries(
		(
			await Promise.all(
				(
					await fs.readdir(routeDir)
				).map(async (category) => {
					const categoryDir = path.join(routeDir, category)
					// if the path is not a directory, ignore it
					if (!(await fs.lstat(categoryDir)).isDirectory()) {
						return null
					}
					if (category.startsWith('_')) {
						return null
					}

					// check to see if there is an index file
					const indexFile = JSON.parse(
						await fs.readFile(path.join(categoryDir, 'index.json'), 'utf-8')
					)

					let filepath = path.join(categoryDir, '+page.svx')
					const list = [await extractInfo(filepath, category)].concat(
						await Promise.all(
							indexFile.pages.map(async (child) => {
								// the file's path
								let filepath = path.join(categoryDir, child, '+page.svx')
								return extractInfo(filepath, category, child)
							})
						)
					)

					return [category, list]
				})
			)
		).filter(Boolean)
	)

	// transform the keys of an object
	const result = Object.fromEntries(
		['intro', 'guides', 'api'].map((category) => {
			const files = content[category]

			return [
				category,
				{
					// pretty print the category name
					name:
						{
							intro: 'Get started',
							guides: 'Guides',
							api: 'API'
						}[category] || category,
					// set the first file as the default
					index: {
						...files[0],
						next: files[1]
					},
					// add the prev and next references
					files: files.map((file, i) => ({
						...file,
						previous: files[i - 1],
						next: files[i + 1]
					}))
				}
			]
		})
	)

	return result
}
