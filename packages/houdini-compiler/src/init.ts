import path from 'path'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import { getIntrospectionQuery } from 'graphql'
import fs from 'fs/promises'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined) => {
    // we need to collect some information from the user before we 
    // can continue
    let { schemaPath, url, directory } = await inquirer.prompt([
        {
            name: 'url',
            type: 'input',
            message: 'Please enter the URL for your api with its protocol.'
        },
        {
            name: 'directory',
            type: 'input',
            message: 'Where would you like to put the generated runtime?',
            default: './__houdini__', 
        },
        {
            name: "schemaPath",
            type: 'input',
            message: "Do you have a json representation of your schema? If so, enter its relative path here. If not, leave this blank - I'll pull it down for you."
        }
    ])

    // if no path was given, we'll use cwd
    const targetPath = _path ? path.resolve(_path) : process.cwd()

    // the source directory
    const sourceDir = path.join(targetPath, 'src')
    // the config file path
    const configPath = path.join(targetPath, 'houdini.config.js')
    // where we put the environment
    const environmentPath = path.join(sourceDir, 'environment.js')

    // if we dont have a schema path, we need to grab it from the api
    if (!schemaPath) {
        // where we'll put it
        schemaPath = './schema.json'

        // send the request
        const resp = await fetch(url, {
            method: 'post',
            body: JSON.stringify({
                body: getIntrospectionQuery()
            }),
            headers: {'Content-Type': 'application/json'}
        })
        const {data} = await resp.json()

        // write the schema file 
        await fs.writeFile(path.resolve(path.join(targetPath, schemaPath)), JSON.stringify(data), 'utf-8')
    }

    // write the config file
    await fs.writeFile(configPath, configFile(directory, schemaPath))
    // write the environment file
    await fs.writeFile(environmentPath, networkFile(url))
}


const networkFile = (url: string) => `
import { Environment } from 'houdini'
import fetch from 'cross-fetch'

export default new Environment(async ({ text, variables = {} }) => {
	// send the request to the ricky and morty api
	const result = await fetch('${url}', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: text,
			variables,
		}),
	})

	// parse the result as json
	return await result.json()
})
`

const configFile = (runtimeDirectory: string, schemaPath: string) => `
const path = require('path')

module.exports = {
	runtimeDirectory: path.resolve(${runtimeDirectory}),
	schemaPath: path.resolve(${schemaPath}),
	sourceGlob: 'src/{routes,components}/*.svelte',
}
`