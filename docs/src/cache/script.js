// https://medium.com/@matswainson/building-a-search-component-for-your-next-js-markdown-blog-9e75e0e7d210
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

const getDocs = async () => {
	const docsDirectory = path.join(process.cwd(), './src/routes/docs')
	const fileNames = fs.readdirSync(docsDirectory)

	// @ts-ignore
	const docs = fileNames.filter((fileName) => !fileName.startsWith('__'))
	let newDocs = []
	for (const fileName of docs) {
		const id = fileName.replace(/.md$/, '')
		const fullPath = path.join(docsDirectory, fileName)
		const fileContents = fs.readFileSync(fullPath, 'utf8')
		const matterResults = matter(fileContents)
		const ast = unified()
			.use(remarkParse)
			.use(remarkGfm)
			// .use(remarkRehype)
			// .use(rehypeStringify)
			.parse(fileContents)
		// .process(fileContents)
		// .then((file) => {
		// 	console.log(String(file))
		// })
		const ret = []
		let newObject = {}
		ast.children.forEach((c) => {
			if (c.type === 'thematicBreak') return

			if (c.type === 'heading') {
				if (newObject.id != null) {
					ret.push(newObject)
					newObject = {}
				}
				newObject.id = 'hi'
				// console.log('headingChildren', c.children);
				const ss = unified().use(remarkRehype).use(rehypeStringify).parse(c.children)
				console.log({ ss })
			} else {
				newObject.content = 'content'
			}
		})
		// console.log(ast.children)
		newDocs.push({
			id,
			title: matterResults.data.title,
			content: matterResults.content,
		})
	}

	return JSON.stringify(docs)
}

const fileContents = `export const docs = ${getDocs()}`

fs.writeFile('src/cache/data.ts', fileContents, (err) => {
	if (err) {
		return console.error(err)
	}
	console.log('Docs cached.')
})
