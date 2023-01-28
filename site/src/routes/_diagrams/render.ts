import { test, expect } from '@playwright/test'
import { mkdirp } from 'fs-extra'
import fs from 'fs/promises'

const lineColor = 'var(--contrast)'
const canvasColor = 'var(--hue)'
const borderColor = 'var(--contrast)'
const backgroundColor = 'var(--discreet2)'
const textColor = 'var(--contrast)'

test('has title', async ({ page }) => {
	await page.goto('http://localhost:3078/_diagrams')

	// wait for the diagram to be rendered
	await page.waitForSelector('pre.mermaid[data-processed="true"]')

	await mkdirp('./src/diagrams')

	// loop over the list of diagrams and create the appropriate files
	const diagrams = ['setup', 'extract', 'validate', 'generate']
	for (const [i, diagramName] of diagrams.entries()) {
		// get the diagram contents
		// and map the internal colors with their semantic equivalent:
		// green -> line color
		let fullDiagram = (await page.innerHTML(`pre.mermaid>>nth=${i}`))
			.replace(/green/g, lineColor)
			.replace(/red/g, canvasColor)
			.replace(/orange/g, borderColor)
			.replace(/purple/, backgroundColor)
			.replace(/yellow/g, textColor)

		// we need to add {...$$props} to the tag, so find the first >
		const firstClose = fullDiagram.indexOf('>')
		// and add the prop spread
		fullDiagram =
			fullDiagram.substring(0, firstClose) + ' {...$$props} ' + fullDiagram.substring(firstClose)

		// create the appropriate file
		await fs.writeFile(`src/routes/_diagrams/rendered/${diagramName}.svelte`, fullDiagram, 'utf-8')
	}
})
