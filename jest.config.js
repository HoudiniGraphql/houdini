export default {
	preset: 'ts-jest',
	moduleFileExtensions: ['js', 'ts'],
	snapshotSerializers: ['ts-ast-serializer'],
	setupFilesAfterEnv: ['./jest.setup.js'],
	moduleNameMapper: {
		'~/common': '<rootDir>/src/common',
		'~/runtime/*': '<rootDir>/src/runtime/*',
	},
}
