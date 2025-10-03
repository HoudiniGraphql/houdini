import type { ConfigFile } from 'legacy/lib'

export function testConfigFile({ plugins, ...config }: Partial<ConfigFile> = {}): ConfigFile {
	return {
		scalars: {
			DateTime: {
				type: 'Date',
				unmarshal(val: number): Date {
					if (typeof val !== 'number') {
						throw new Error('unmarshaling not a number')
					}
					return new Date(val)
				},
				marshal(date: Date): number {
					return date.getTime()
				},
			},
		},
		types: {
			Ghost: {
				keys: ['name', 'aka'],
				resolve: {
					queryField: 'ghost',
				},
			},
			CustomIdType: {
				keys: ['foo', 'bar'],
			},
		},
		logLevel: 'quiet',
		plugins: {
			'houdini-svelte': {
				client: './my/client/path',
			},
			...plugins,
		},
		runtimeScalars: {
			ViewerIDFromSession: {
				type: 'ID',
				resolve: ({ session }: { session?: App.Session | null | undefined }) =>
					(session as unknown as any).token,
			},
		},
		...config,
	}
}
