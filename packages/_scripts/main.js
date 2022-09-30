import { program } from 'commander'

import build from './build.js'

program.command('build').action(build)

// run the program
program.parse()
