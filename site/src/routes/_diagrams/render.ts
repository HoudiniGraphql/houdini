import { test, expect } from '@playwright/test'
import { mkdirp } from 'fs-extra'
import fs from 'fs/promises'

test('has title', async ({ page }) => {
	await page.goto('http://localhost:3078/_diagrams')

	// wait for the diagram to be rendered
	await page.waitForSelector('pre.mermaid[data-processed="true"]')

	// get the diagram contents
	// and map the internal colors with their semantic equivalent:
	// green -> line color
	const fullDiagram = (await page.innerHTML('pre.mermaid')).replace(/green/g, 'var(--contrast)')

	await mkdirp('./src/diagrams')
	await fs.writeFile('src/diagrams/full.svelte', fullDiagram, 'utf-8')
})
