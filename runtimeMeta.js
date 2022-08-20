import fs from 'fs'

const packageJSON = JSON.parse(fs.readFileSync('./package.json'))

fs.writeFileSync(
	`build/runtime-${process.env.WHICH}/meta.json`,
	JSON.stringify({
		version: packageJSON.version,
		timestamp: new Date().getTime(),
	})
)
