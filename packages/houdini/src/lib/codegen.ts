import type { ConfigFile } from './project'

export async function run_codegen(config: ConfigFile, configServerPort: number): Promise<void> {
	// each plugin is a standalone process that need to be started behind the scenes
}
