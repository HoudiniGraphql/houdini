import { program } from 'commander'

import build from './build.js'
import typedefs from './typedefs.js'

program.command('build').action(build)
program.command('typedefs').action(typedefs)

// run the program
program.parse()
