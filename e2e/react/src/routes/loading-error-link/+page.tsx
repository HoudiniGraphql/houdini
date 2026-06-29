import { Link } from '$houdini'

// A query-less page whose only job is to link into the erroring @loading route so the e2e
// suite can exercise a client-side navigation into it (not just the initial SSR load).
export default function () {
	return (
		<Link id="to-loading-error" to="/loading-error">
			go to loading-error
		</Link>
	)
}
