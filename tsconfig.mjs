export default {
	compilerOptions: {
		strict: true,
		esModuleInterop: true,
		lib: ['es2019', 'es2017', 'es7', 'es6', 'dom', 'esnext'],
		skipLibCheck: true,
		downlevelIteration: true,
		target: 'es5',
		sourceMap: false,
		declaration: true,
		typeRoots: ['./node_modules/@types', '.'],
	},
}
