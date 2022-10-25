import type { NextConfig } from 'next'

export function withHoudini(nextConfig?: NextConfig): NextConfig {
	return {
		...nextConfig,
		webpack(config, options) {
			config.module.rules.unshift({
				test: /\.(jsx|tsx|js|ts)$/,
				use: [options.defaultLoaders.babel],
			})

			if (nextConfig && typeof nextConfig.webpack === 'function') {
				return nextConfig.webpack(config, options)
			}

			return config
		},
	}
}
