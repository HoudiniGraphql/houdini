import { PageProps } from './$types'

export default function HandleTest({ HandleUserQuery, HandleUserQuery$handle }: PageProps) {
	// grab the current size from the query handle
	const currentSize = HandleUserQuery$handle.variables.size ?? 50

	return (
		<div>
			<div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
				<button
					id="user-1"
					onClick={() => HandleUserQuery$handle.fetch({ variables: { userID: '1' } })}
				>
					load 1
				</button>
				<button
					id="user-2"
					onClick={() => HandleUserQuery$handle.fetch({ variables: { userID: '2' } })}
				>
					load 2
				</button>
				<button
					id="larger"
					onClick={() =>
						HandleUserQuery$handle.fetch({
							variables: {
								size: currentSize + 1,
							},
						})
					}
				>
					larger
				</button>
			</div>
			<div
				id="result"
				data-user={HandleUserQuery$handle.variables.userID}
				data-size={currentSize}
			>
				{HandleUserQuery.user.avatarURL}
			</div>
			<div id="variables">{JSON.stringify(HandleUserQuery$handle.variables)}</div>
		</div>
	)
}
