declare global {
	namespace jest {
		interface Matchers<R> {
			toMatchArtifactSnapshot(expected?: string): Promise<R>
			toMatchJavascriptSnapshot(expected?: string): Promise<R>
		}
	}
}

export {}
