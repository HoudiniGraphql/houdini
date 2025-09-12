import { ConfigEnv, Plugin as VitePlugin, UserConfig } from 'vite';
import type { PluginConfig } from '.'

let viteEnv: ConfigEnv

export default function(opts: PluginConfig = {}) : VitePlugin {
    return {
        name: 'houdini',

        // houdini will always act as a "meta framework" and process the user's code before it
        // is processed by the user's library-specific plugins.
        enforce: 'pre',

        async config(userConfig, env) {
          viteEnv = env
  
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
        }


    }
}
