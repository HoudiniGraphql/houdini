import type { Config } from '../lib/config.js'
import { format_error } from '../lib/error.js'
import {
	codegen_setup,
	init_db,
	run_pipeline,
	type RunPipelineOptions,
	PIPELINE_HOOKS,
	type PipelineHook,
} from '../lib/index.js'
import { get_config } from '../lib/project.js'
import pull_schema from './pullSchema.js'

export async function generate(
	args: {
		pullSchema: boolean
		persistOutput?: string
		output?: string
		headers: string[]
		log?: string
		verbose: boolean
		mode?: string
		preserveDatabase: boolean
		afterPhase?: PipelineHook
		beforePhase?: PipelineHook
	} = {
		pullSchema: false,
		headers: [],
		verbose: false,
		preserveDatabase: false,
	}
) {
	// make sure there is always a mode
	const mode = args.mode ?? 'development'

	// until we've initialized the pipeline, there's nothing to do on close
	let on_close = async () => {}

	// make sure we pull the schema if we specify
	if (args.pullSchema) {
		await pull_schema({ headers: args.headers, output: args.output })
	}

	try {
		// grab the config file
		let config: Config | null = await get_config()

		const [db, dbFilepath] = await init_db(config, args.preserveDatabase)

		// initialize the codegen pipe
		const { trigger_hook, close } = await codegen_setup(config, mode, db, dbFilepath)

		// Function to handle graceful shutdown
		on_close = async () => {
			try {
				await close()
				process.exit(0)
			} catch (error) {
				process.exit(1)
			}
		}

		// Set up signal handlers
		process.on('SIGINT', on_close)
		process.on('SIGTERM', on_close)

		// Validate phase arguments
		if (args.afterPhase && !PIPELINE_HOOKS.includes(args.afterPhase)) {
			throw new Error(
				`Invalid --after-phase: ${args.afterPhase}. Valid phases are: ${PIPELINE_HOOKS.join(
					', '
				)}`
			)
		}
		if (args.beforePhase && !PIPELINE_HOOKS.includes(args.beforePhase)) {
			throw new Error(
				`Invalid --before-phase: ${
					args.beforePhase
				}. Valid phases are: ${PIPELINE_HOOKS.join(', ')}`
			)
		}

		// Build pipeline options
		const pipelineOptions: RunPipelineOptions = {
			after: 'Schema',
		}

		// If afterPhase is specified, use it; otherwise default to 'Schema'
		if (args.afterPhase) {
			pipelineOptions.after = args.afterPhase
		}

		// If beforePhase is specified, use it as 'through'
		if (args.beforePhase) {
			pipelineOptions.through = args.beforePhase
		}

		// kick off the codegen pipeline (the pipeline through Schema is run in codegen_setup)
		await run_pipeline(trigger_hook, pipelineOptions)

		// we're done, close everything
		await on_close()
	} catch (e) {
		// if something goes wrong, format the error
		format_error(e, (error) => {
			console.error(error.stack?.split('\n').slice(1).join('\n'))
		})

		// attempt to close any plugins
		try {
			on_close()
		} catch (closeError) {
			console.error('Error closing plugins:', closeError)
		}
		process.exit(1)
	}
}
