import { goto as go } from '$app/navigation'
import { session } from '$app/stores'

export function getSession() {
    return session
}

export function goTo(location, options) {
    go(location, options)
}
