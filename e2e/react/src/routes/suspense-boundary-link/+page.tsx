import { Link } from '$houdini'

// A query-less page whose only job is to link into the suspense-boundary route from a
// different entry, so a test can exercise a cross-route navigation (the layout — and its
// hand-rolled boundary — mounts fresh).
export default function () {
	return (
		<Link id="to-suspense-boundary" to="/suspense-boundary" search={{ delay: 1500 }}>
			go to suspense-boundary
		</Link>
	)
}
