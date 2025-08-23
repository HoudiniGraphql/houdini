import { program } from 'commander'

import buildGo from './buildGo.js'
import buildNode from './buildNode.js'
import typedefs from './typedefs.js'

program
	.command('build-node')
	.option('-p, --plugin', 'build the package as a plugin')
	.action(buildNode)
program.command('typedefs').option('-p, --plugin', 'generate typedefs as a plugin').action(typedefs)
program.command('build-go').action(buildGo)

// run the program
program.parse()
