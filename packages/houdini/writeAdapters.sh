cat >build/runtime-cjs/adapter.mjs <<!EOF
import { stores, goto as go } from '@sapper/app'

export function getSession() {
    return stores().session
}

export function goTo(location, options) {
    go(location, options)
}
!EOF

cat >build/runtime-esm/adapter.mjs <<!EOF
import { goto as go } from '$app/navigation'
import { session } from '$app/stores'

export function getSession() {
    return session
}

export function goTo(location, options) {
    go(location, options)
}
!EOF