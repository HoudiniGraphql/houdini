export default {
	preset: 'ts-jest', // or other ESM presets
	moduleFileExtensions: ['js', 'ts'],
	snapshotSerializers: ['ts-ast-serializer'],

	moduleNameMapper: {
		'^~/(.*)$': '<rootDir>/src/$1',
	},
}
