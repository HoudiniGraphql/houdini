// externals
import path from 'path'
// locals
import { Config } from '../../../common'
import { writeFile } from '../../utils'

export default async function metaGenerator(config: Config) {
	const meta = {
		version: 'HOUDINI_VERSION',
	}

	await writeFile(config.metaFilePath, JSON.stringify(meta))
}
