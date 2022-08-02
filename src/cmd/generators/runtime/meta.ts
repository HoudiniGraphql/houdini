// locals
import { Config, writeFile } from '../../../common'

export default async function metaGenerator(config: Config) {
	const meta = {
		version: 'HOUDINI_VERSION',
	}

	await writeFile(config.metaFilePath, JSON.stringify(meta))
}
