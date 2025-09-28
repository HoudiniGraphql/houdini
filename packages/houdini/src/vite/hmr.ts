import type { DatabaseSync } from 'node:sqlite'
import { Plugin as VitePlugin, UserConfig } from 'vite'
import type { ModuleNode } from 'vite'

import type { PluginConfig } from '.'
import {
	codegen_setup,
	CompilerProxy,
	connect_db,
	fs,
	get_config,
	path,
	run_pipeline,
} from '../lib'
import type { Config } from '../lib'

/**
 * Houdini Vite HMR Plugin
 *
 * This plugin provides hot module replacement (HMR) functionality for Houdini GraphQL documents.
 * It handles two main scenarios:
 *
 * 1. File changes: When .gql files or files containing graphql`` template literals are modified,
 *    it triggers recompilation of the affected documents and their dependencies.
 *
 * 2. Artifact imports: When a user imports an artifact (e.g., `import artifact from '$houdini/artifacts/MyQuery'`),
 *    it ensures the artifact and all its dependencies are generated before the import resolves.
 *
 * The plugin uses the same dependency resolution logic for both scenarios, walking both up and down
 * the dependency graph to ensure all related documents are properly regenerated.
 */

let config: Config
let db: DatabaseSync
let compiler: CompilerProxy

export default function (opts: PluginConfig = {}): VitePlugin {
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
			;[db, dbFile] = connect_db(config)

			// and a proxy to talk to the compiler
			compiler = await codegen_setup(config, 'dev', db, dbFile)

			// before we can do anything we need to discover what documents exist on the filesystem
			// we need to trigger validate in order to discover lists which might not appear in the normal JIT path
			// TODO: discover lists earlier
			await run_pipeline(compiler.trigger_hook, { before: 'AfterValidate' })
		},

		async buildEnd() {
			compiler?.close()
		},

		// this is called when a module is being resolved
		async resolveId(id) {
			// check if this is an artifact import
			if (id.startsWith('$houdini/artifacts/')) {
				const match = id.match(/^\$houdini\/artifacts\/(.+)$/)
				const artifactName = match ? match[1] : null
				if (artifactName && db && compiler) {
					try {
						// ensure the artifact and its dependencies are generated
						await ensureArtifactGenerated(artifactName, db, compiler)
					} catch (error) {
						console.error(error)
					}
				}
			}
			// let vite handle the actual resolution
			return null
		},

		// this is called when a file is created or modified
		async handleHotUpdate({ file, read, server, timestamp }): Promise<void | ModuleNode[]> {
			const contents = await read()
			// if the file contains a document then we need to parse it, and prepare the task with
			// with the dependent documents
			const relevant = file.endsWith('.gql') || contents.includes('$houdini')
			if (!relevant) {
				return
			}

			const relativePath = file.substring(server.config.root.length + 1)
			const task_id = timestamp.toString()

      // ideally we would be able to check if the file's content has changed before we re-run but there could
      // be abitrary extraction logic in a plugin that means we have to instead defer to them 

      // so let's just blow away any raw documents related to the changed file and then we'll call extract
      db.prepare(`
          DELETE from raw_documents WHERE filepath = ?
      `).run(relativePath)

      // clean up any dangling references
      db.prepare(
        `
          WITH orphan_selections AS (
            SELECT s.id
            FROM selections s
            LEFT JOIN selection_refs rp ON rp.parent_id = s.id
            LEFT JOIN selection_refs rc ON rc.child_id = s.id
            WHERE rp.id IS NULL AND rc.id IS NULL
          )
          DELETE FROM selections
          WHERE id IN (SELECT id FROM orphan_selections)
        `
      ).run()

      // tell the plugin to extract the filepath
      await compiler.trigger_hook('ExtractDocuments', {
        payload: { filepath: file }
      })

      // look for the raw document that matches the filepath
      const result =  db.prepare(`
        UPDATE raw_documents SET current_task = ? WHERE filepath = ?
      `).run(task_id, relativePath)

      // if the update did not contain any changes, then there were no extracted files
      if (result.changes === 0) {
        return 
      }

			// at this point, the raw_documents with the matching task ID make up the core set of documents
			// that have changed because of this update event
			//
			// instruct the compiler to parse and load the content into the database
			await compiler.trigger_hook('AfterExtract', { task_id })

			// now that all of the documents have been updated to their latest version we can
			// walk the dependency graph and include any transient dependencys to the task
			// aswell
			db.prepare(
				`
					WITH RECURSIVE
					-- 1) Seed: names of docs already in this task
					seed AS (
						SELECT DISTINCT d.name
						FROM raw_documents rd
						JOIN documents d ON d.raw_document = rd.id
						WHERE rd.current_task = $task_id
					),

					-- 2) Walk UP: find docs that depend on any visited name
					up AS (
						SELECT name FROM seed
						UNION
						SELECT d2.name
						FROM up u
						JOIN document_dependencies dd ON dd.depends_on = u.name
						JOIN documents d2            ON d2.id = dd.document
					),

					-- 3) Walk DOWN: find names that any visited name depends on (transitively)
					down AS (
						SELECT name FROM seed
						UNION
						SELECT dd.depends_on
						FROM down v
						JOIN documents d          ON d.name = v.name
						JOIN document_dependencies dd ON dd.document = d.id
					),

					-- 4) Raw docs to tag from the UP walk (no extra filter)
					targets_up AS (
						SELECT DISTINCT d.raw_document AS raw_id
						FROM documents d
						JOIN up u ON u.name = d.name
						WHERE d.raw_document IS NOT NULL
					),

					-- 5) Raw docs to tag from the DOWN walk, but only if regen is needed
					targets_down AS (
						SELECT DISTINCT d.raw_document AS raw_id
						FROM documents d
						JOIN down v        ON v.name = d.name
						JOIN raw_documents rd ON rd.id = d.raw_document
						WHERE d.raw_document IS NOT NULL
					),

					-- 6) Union both directions
					targets AS (
						SELECT raw_id FROM targets_up
						UNION
						SELECT raw_id FROM targets_down
					)

					-- 7) Update the task set
					UPDATE raw_documents
					SET current_task = $task_id
					WHERE id IN (SELECT raw_id FROM targets);
				`
			).run({ task_id: task_id })

			// the task now includes every document that we need to process
			const results = await run_pipeline(compiler.trigger_hook, {
				task_id,
				after: 'AfterExtract',
			})

			// the return value of each generate invocation is the list of modules that were updated
			const updated_modules = Object.values(results.Generate || {}).flat() as Array<string>

			// and finally we can remove the task id association
			db.prepare(`UPDATE raw_documents SET current_task = NULL WHERE current_task = ?`).run(
				task_id
			)

			// the return value of this function invalidates the modules and causes vite to refresh them
			// Convert file paths to ModuleNode objects
			const moduleNodes: ModuleNode[] = []
			for (const modulePath of updated_modules) {
				const moduleNode = server.moduleGraph.getModuleById(modulePath)
				if (moduleNode) {
					moduleNodes.push(moduleNode)
				}
			}
			return moduleNodes
		},
	}
}

/**
 * Ensure that the specified artifact and all its dependencies are generated
 */
async function ensureArtifactGenerated(
	artifactName: string,
	db: DatabaseSync,
	compiler: CompilerProxy
): Promise<void> {
	// before we do anything let's see if the artifact has been generated already
	try {
		await fs.access(
			path.join(config.root_dir, config.config_file.runtimeDir!, 'artifacts', artifactName)
		)
		// if stat doesn't throw, the file exists
		return
	} catch {}

	const timestamp = Date.now()
	const task_id = `artifact_${artifactName}_${timestamp}`

	// Check if the artifact document exists in the database
	const documentQuery = db.prepare(`
		SELECT d.id, d.name, rd.id as raw_document_id
		FROM documents d
		LEFT JOIN raw_documents rd ON rd.id = d.raw_document
		WHERE d.name = ?
	`)
	const document = documentQuery.get(artifactName) as
		| { id: number; name: string; raw_document_id: number | null }
		| undefined

	// if document doesn't exist, there's nothing to generate
	if (!document || !document.raw_document_id) {
		return
	}

	// mark the document as part of this task
	db.prepare(`UPDATE raw_documents SET current_task = ? WHERE id = ?`).run(
		task_id,
		document.raw_document_id
	)

	// Find all dependencies using the same recursive query as handleHotUpdate
	db.prepare(
		`
			WITH RECURSIVE
			seed AS (
				SELECT DISTINCT d.name
				FROM raw_documents rd
				JOIN documents d ON d.raw_document = rd.id
				WHERE rd.current_task = $task_id
			),

			walk AS (
				SELECT name FROM seed
				UNION
				SELECT dd.depends_on
				FROM down v
				JOIN documents d          ON d.name = v.name
				JOIN document_dependencies dd ON dd.document = d.id
			),

			targets AS (
				SELECT DISTINCT d.raw_document AS raw_id
				FROM documents d
				JOIN walk v        ON v.name = d.name
				JOIN raw_documents rd ON rd.id = d.raw_document
				WHERE d.raw_document IS NOT NULL
			),

			UPDATE raw_documents
			SET current_task = $task_id
			WHERE id IN (SELECT raw_id FROM targets);
		`
	).run({ task_id: task_id })

	// Run the compilation pipeline for this task
	await run_pipeline(compiler.trigger_hook, {
		task_id,
		after: 'AfterExtract',
	})

	// Clean up the task
	db.prepare(`UPDATE raw_documents SET current_task = NULL WHERE current_task = ?`).run(task_id)
}
