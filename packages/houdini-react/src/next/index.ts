import type { NextConfig } from 'next'

export function withHoudini(nextConfig?: NextConfig): NextConfig {
	return {
		...nextConfig,
		webpack(config, options) {
			config.module.rules.push({
				test: /\.(jsx|tsx)$/,
				use: [
					options.defaultLoaders.babel,
					{
						loader: 'houdini/webpack',
					},
				],
			})

			if (nextConfig && typeof nextConfig.webpack === 'function') {
				return nextConfig.webpack(config, options)
			}

			return config
		},
	}
}
