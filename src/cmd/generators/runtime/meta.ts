import { Config, writeFile } from '../../../common'

export default async function metaGenerator(config: Config) {
	const meta = {
		version: 'HOUDINI_VERSION',
		client: config.client,
	}

	await writeFile(config.metaFilePath, JSON.stringify(meta))
}
