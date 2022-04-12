export default {
	preset: 'ts-jest/presets/default-esm', // or other ESM presets
	moduleFileExtensions: ['js', 'ts'],
	snapshotSerializers: ['ts-ast-serializer'],

	// typescript + esm support
	extensionsToTreatAsEsm: ['.ts'],
	globals: {
		'ts-jest': {
			useESM: true,
			sourcemaps: true,
		},
	},
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
		'^~/(.*)$': '<rootDir>/src/$1',
	},
}
