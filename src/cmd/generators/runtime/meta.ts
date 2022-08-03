// locals
import { writeFile } from '../../../common/fs'
import { Config } from '../../../common/config'

export default async function metaGenerator(config: Config) {
	const meta = {
		version: 'HOUDINI_VERSION',
	}

	await writeFile(config.metaFilePath, JSON.stringify(meta))
}
