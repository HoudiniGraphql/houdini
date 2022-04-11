export default {
	preset: 'ts-jest',
	moduleFileExtensions: ['js', 'ts'],
	snapshotSerializers: ['ts-ast-serializer'],
	setupFilesAfterEnv: ['./jest.setup.js'],
	moduleNameMapper: {
		'~/(.*)': '<rootDir>/src/$1',
	},
}
