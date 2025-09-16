import { codegen_setup, CompilerProxy, connect_db, get_config } from '../lib';
import type { Config } from '../lib'
import { Plugin as VitePlugin, UserConfig } from 'vite';
import type { DatabaseSync} from 'node:sqlite'
import type { PluginConfig } from '.'

let config: Config
let db: DatabaseSync 
let compiler: CompilerProxy

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
          async configureServer(server) {
              // we need a reference to the database connection
              let dbFile: string
              [db, dbFile] = connect_db(config)

              // and a proxy to talk to the compiler
              compiler = await codegen_setup(config, 'dev', db, dbFile)
          },

          async buildEnd() {
            compiler?.close()
          },

          // this is called when a file is created or modified
          async handleHotUpdate({ file, read, server, timestamp }) {
              const contents = await read()
              // if the file contains a document then we need to parse it, and prepare the task with 
              // with the dependent documents
              const relevantChange = file.endsWith(".gql") || contents.includes("$houdini")
              if (!relevantChange) {
                return
              }

              const relativePath = file.substring(server.config.root.length)
              const task_id = timestamp

              // every document that we find here is part of the task so update the rows indepdently before
              // we kick of the next task
              const names = extractAllGraphQLNames(relativePath, contents)
              for (const name of names) {
                  const graphqlRegex = new RegExp("/graphql\(\s*`((?:\\`|[^`])*?)`\s*\)/s")
                  const docContents = file.endsWith(".gql") ? contents : (graphqlRegex).exec(contents)?.[1]

                  // before we go any further we want to check if the document actually changed
                  const existingQuery = db.prepare(`
                      SELECT content, raw_documents.id as raw_document, documents.id as document
                      FROM raw_documents 
                      JOIN documents ON raw_documents.id = documents.raw_document
                      WHERE name = ? OR content = ?
                  `)
                      .get(name, docContents) as {content: string; raw_document: number, document: number} | undefined
                  if (!docContents || (existingQuery && existingQuery.content === docContents)) {
                    return
                  }
                  if (existingQuery) {
                    cleanUpDocument(db, existingQuery.raw_document)
                  }

                  // insert a fresh row with the raw document data
                  db.prepare(`INSERT INTO raw_documents (filepath, content, current_task) VALUES (?, ?, ?)`)
                    .run(relativePath, docContents, task_id)
              }

              // at this point, the raw_documents with the matching task ID make up the core set of documents 
              // that we are interested in working on
              
              // now that the raw documents exist and is given a task id, we need to instruct the compiler 
              // to parse and load the content into the database
              await compiler.trigger_hook('AfterExtract', { task_id })

              // extract the document name from what we loaded

              // now that the document is loaded we need to look at the dependents of the document
              // and find any dependents that haven't been loaded into the database yet
              
              // and finally look for any documents that depend on the document we just loaded 
              // for newly created files, this will be empty

              // this set of 3 sources defines the task for this execution

          }
    }
}

function cleanUpDocument(db: DatabaseSync, id: number) {
  try { 
      // there are a bunch of tables that we need to clean up
      const result = db.prepare(`DELETE FROM raw_documents WHERE id = ?`).run(id)

      // drop any selections that don't have refs
      db.prepare(`
          WITH orphan_selections AS (
            SELECT s.id
            FROM selections s
            LEFT JOIN selection_refs rp ON rp.parent_id = s.id
            LEFT JOIN selection_refs rc ON rc.child_id = s.id
            WHERE rp.id IS NULL AND rc.id IS NULL
          )
          DELETE FROM selections
          WHERE id IN (SELECT id FROM orphan_selections)
      `).run()
  } catch(e) {
    throw e
  }
}

const DEF_NAME_RE = /\b(?:query|mutation|subscription|fragment)\s+([_A-Za-z][_0-9A-Za-z]*)\b/g;

function extractDefNamesFromText(text: string): string[] {
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = DEF_NAME_RE.exec(text))) {
    names.push(m[1]);
  }
  return names;
}

// Use this in your handler:
function extractAllGraphQLNames(filePath: string, contents: string): string[] {
  if (filePath.endsWith('.gql')) {
    // Entire file is GraphQL
    return extractDefNamesFromText(contents);
  }

  // Otherwise, scan each graphql`...` block inside the source file
  const names: string[] = [];
  for (const m of contents.matchAll(GRAPHQL_BLOCK_RE)) {
    names.push(...extractDefNamesFromText(m[1]));
  }
  return names;
}
