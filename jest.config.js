export default {
	preset: 'ts-jest', // or other ESM presets
	moduleFileExtensions: ['js', 'ts'],
	snapshotSerializers: ['ts-ast-serializer'],

	moduleNameMapper: {
		'^~/(.*)$': '<rootDir>/src/$1',
	},

	modulePathIgnorePatterns: ['<rootDir>/integration/', '<rootDir>/build'],

	globals: {
		'ts-jest': {
			babelConfig: true,
		},
	},

	testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '!**/example/tests/**'],
}
