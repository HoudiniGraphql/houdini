#! /usr/bin/env node

// externals
import path from 'path'
// locals
import compile from './compile'

compile({
	artifactDirectory: path.join(__dirname, '..', '..', '..', 'example', 'generated'),
})
