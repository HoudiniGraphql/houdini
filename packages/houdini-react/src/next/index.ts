import type { NextConfig } from 'next'
import path from 'path'

export function withHoudini(nextConfig?: NextConfig): NextConfig {
	return {
		...nextConfig,
		webpack(config, options) {
			config.module.rules.push({
				test: /\.(jsx|tsx)$/,
				use: [
					options.defaultLoaders.babel,
					{
						loader: path.resolve(__dirname, 'loader.js'),
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
