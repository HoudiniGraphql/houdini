import type { Config } from 'houdini'

export let _config: Config

export function setConfig(config: Config) {
    _config = config
}