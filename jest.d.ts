declare global {
	namespace jest {
		interface Matchers<R> {
			toMatchArtifactSnapshot(expected?: string): Promise<R>
			toMatchTypescriptSnapshot(path?: string): Promise<R>
		}
	}
}

export {}
