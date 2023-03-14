export default function () {
	const data = useTest(1)
	return <div>{JSON.stringify(data)}</div>
}

let data: any = null

function useTest(id: number) {
	if (data) {
		return data
	}

	throw new Promise((resolve) => {
		setTimeout(() => {
			data = { hello: 'world' + id }
			resolve()
		}, 1000)
	})
}
