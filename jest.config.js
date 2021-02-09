// jest.config.js
const { defaults } = require('jest-config')

module.exports = {
	projects: ['<rootDir>/packages/*'],
	moduleFileExtensions: [...defaults.moduleFileExtensions, 'ts'],
	snapshotSerializers: ['ts-ast-serializer'],
	setupFilesAfterEnv: ['./jest.setup.js'],
}
