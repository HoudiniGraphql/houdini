const { withHoudini } = require('houdini-react/next')

/** @type {import('next').NextConfig} */
const nextConfig = withHoudini({
	reactStrictMode: true,
	swcMinify: true,
	experimental: {
		appDir: true,
	},
})

module.exports = nextConfig
