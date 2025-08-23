import * as graphql from 'graphql'
import path from 'node:path'

import { routerConventions } from '..'
import { fs } from '../../lib'
import type { Config } from '../../lib/config'
import { localApiEndpoint, type ConfigFile } from '../../lib/types'
