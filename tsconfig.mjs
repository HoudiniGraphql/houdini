export default {
	compilerOptions: {
		strict: true,
		esModuleInterop: true,
		lib: ['es2019', 'es2017', 'es7', 'es6', 'dom', 'esnext'],
		skipLibCheck: true,
		downlevelIteration: true,
		target: 'es2019',
		types: ['node', 'jest'],
		sourceMap: false,
		declaration: true,
		typeRoots: ['./node_modules/@types', '.'],
		moduleResolution: 'node',
	},
}
