declare global {
	namespace vitest {
		interface Matchers<R> {
			toMatchArtifactSnapshot(expected?: string): Promise<R>
			toMatchJavascriptSnapshot(expected?: string): Promise<R>
		}
	}
}

export {}
