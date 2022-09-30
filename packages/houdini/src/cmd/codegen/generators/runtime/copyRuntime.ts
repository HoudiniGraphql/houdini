import path from 'path'

import { Config, siteURL } from '../../../../lib'
import * as fs from '../../../../lib/fs'
import { CollectedGraphQLDocument } from '../../types'

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// copy the compiled source code to the target directory
	await recursiveCopy(config, config.runtimeSource, config.runtimeDirectory)

	// generate the adapter to normalize interactions with the framework
	// update the generated runtime to point to the client
	await Promise.all([
		addClientImport(config),
		addConfigImport(config),
		addSiteURL(config),
		meta(config),
	])
}

async function recursiveCopy(config: Config, source: string, target: string, notRoot?: boolean) {
	// if the folder containing the target doesn't exist, then we need to create it
	let parentDir = path.join(target, path.basename(source))
	// if we are at the root, then go up one
	if (!notRoot) {
		parentDir = path.join(parentDir, '..')
	}
	try {
		await fs.access(parentDir)
		// the parent directory does not exist
	} catch (e) {
		await fs.mkdir(parentDir)
	}

	// check if we are copying a directory
	if ((await fs.stat(source)).isDirectory()) {
		// look in the contents of the source directory
		await Promise.all(
			(
				await fs.readdir(source)
			).map(async (child) => {
				// figure out the full path of the source
				const childPath = path.join(source, child)

				// if the child is a directory
				if ((await fs.stat(childPath)).isDirectory()) {
					// keep walking down
					await recursiveCopy(config, childPath, parentDir, true)
				}
				// the child is a file, copy it to the parent directory
				else {
					const targetPath = path.join(parentDir, child)
					// Do not write `/runtime/adapter.js` file. It will be generated later depending on the framework.
					if (targetPath.endsWith('/runtime/adapter.js')) {
						return
					}
					await fs.writeFile(targetPath, (await fs.readFile(childPath)) || '')
				}
			})
		)
	}
}

async function addClientImport(config: Config) {
	// all we need to do is compute the relative path from the generated network file
	// to the client in the config file and replace HOUDINI_CLIENT_PATH with the value

	// the path to the network file
	const networkFilePath = path.join(config.runtimeDirectory, 'lib', 'network.js')
	// the relative path
	const relativePath = path.relative(
		path.dirname(networkFilePath),
		path.join(config.projectRoot, config.client)
	)

	// read the file, replace the string, update the file
	const contents = await fs.readFile(networkFilePath)
	if (!contents) {
		return
	}

	await fs.writeFile(networkFilePath, contents.replace('HOUDINI_CLIENT_PATH', relativePath))
}

async function addConfigImport(config: Config) {
	// all we need to do is compute the relative path from the generated config file
	// to the config in the config file and replace HOUDINI_config_PATH with the value

	// the path to the config file
	const configFilePath = path.join(config.runtimeDirectory, 'lib', 'config.js')
	// the relative path
	const relativePath = path.relative(path.dirname(configFilePath), config.filepath)

	// read the file, replace the string, update the file
	const contents = await fs.readFile(configFilePath)
	if (!contents) {
		return
	}

	await fs.writeFile(configFilePath, contents.replace('HOUDINI_CONFIG_PATH', relativePath))
}

async function addSiteURL(config: Config) {
	// all we need to do is replace the string value with the library constant

	// the path to the config file
	const target = path.join(config.runtimeDirectory, 'lib', 'constants.js')

	// read the file, replace the string, update the file
	const contents = await fs.readFile(target)
	if (!contents) {
		return
	}

	await fs.writeFile(target, contents.replace('SITE_URL', siteURL))
}

async function meta(config: Config) {
	// the path to the network file
	const staticMeta = await fs.readFile(path.join(config.runtimeSource, 'meta.json'))
	if (!staticMeta) {
		return
	}

	await fs.writeFile(
		config.metaFilePath,
		JSON.stringify({
			...JSON.parse(staticMeta),
			client: config.client,
		})
	)
}
