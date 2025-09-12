import { connectDatabase, get_config } from '../lib';
import type { Config } from '../lib'
import { db_path } from '../lib/conventions';
import { Plugin as VitePlugin, UserConfig } from 'vite';
import sqlite, { DatabaseSync} from 'node:sqlite'
import type { PluginConfig } from '.'

let config: Config | null = null
let db: DatabaseSync | null = null

export default function(opts: PluginConfig = {}) : VitePlugin {
    return {
          name: 'houdini',

          // houdini will always act as a "meta framework" and process the user's code before it
          // is processed by the user's library-specific plugins.
          enforce: 'pre',

          async config(userConfig, env) {
            // add the necessary values for the houdini imports to resolve
            let result: UserConfig = {
                server: {
                    ...userConfig.server,
                    fs: {
                        ...userConfig.server?.fs,
                        allow: ['.'].concat(userConfig.server?.fs?.allow || []),
                    },
                },
            }

            // we're done
            return result
          },

          async configResolved() {
            config = await get_config()
          },

          // this is called when the dev server starts
          configureServer(server) {
              // we need a reference to the database connection
              db = connectDatabase(config!)
          },

          // this is called when a file is created or modified
          async handleHotUpdate({ file, read, server }) {
              const contents = await read()
              // if the file contains a document then we need to parse it, and prepare the task with 
              // with the dependent documents
              const hasDoc = file.endsWith(".gql") || contents.includes("$houdini")
              if (hasDoc) {
                const relativePath = file.substring(server.config.root.length)

                // before we go any further we want to check if the document actually changed
                let changed = false
                //  the document hasn't changed then there's nothing to do
                if (!changed) {
                  return
                }

                // extract the document name from what we loaded

                // now that the document is loaded we need to look at the dependents of the document
                // and find any dependents that haven't been loaded into the database yet
                
                // and finally look for any documents that depend on the document we just loaded 
                // for newly created files, this will be empty

                // this set of 3 sources defines the task for this execution

              }
          }
    }
}
