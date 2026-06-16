import { redirect } from '$houdini'

export default function RedirectPage() {
	return redirect(302, '/routing-errors/redirect-target')
}
