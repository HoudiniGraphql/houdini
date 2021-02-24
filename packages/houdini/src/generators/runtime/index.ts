// externals
import { Config } from 'houdini-common'
import path from 'path'
import fs from 'fs/promises'
// locals
import { CollectedGraphQLDocument } from '../../types'
import { template } from '@babel/core'

// the runtime generator is responsible for generating a majority of the runtime that the client will use.
// this includes things like query, fragment, mutation, etc. They are generated here instead of 
// imported from npm so that they can be pushed through the bundler in order to use package aliases
// and sapper's internal @sapper/app

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
    // all of the runtime source code is available at the directory locations at ./templates
    const templateDir = path.resolve(__dirname, 'template')
    const templates = await fs.readdir(templateDir)

    // look at every file in the template directory
    for (const filepath of templates) {
        // read the file contents
        const contents = await fs.readFile(path.join(templateDir, filepath), 'utf-8')

        // and write them to the target 
        await fs.writeFile(path.join(config.runtimeDirectory, filepath), contents, 'utf-8')
    }

    // grab the root index file and copy it to a special place (in a test scenario, we are running against .ts files)
    let  rootIndexContents 
    try { 
        rootIndexContents = await fs.readFile(path.join(templateDir, 'root_index.js'), 'utf-8')
    } catch (e) {
        rootIndexContents = await fs.readFile(path.join(templateDir, 'root_index.ts'), 'utf-8') 
    }

    // write the index file that exports the runtime
    await fs.writeFile(path.join(config.rootDir, 'index.js'), rootIndexContents, 'utf-8')   
}