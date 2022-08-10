/// <reference types="@sveltejs/kit" />

interface SessionData {
	// Your session data
	mode: 'inline' | 'store'
}

// See https://kit.svelte.dev/docs#typescript
// for information about these interfaces
declare namespace App {
	interface Locals {
		session: import('svelte-kit-cookie-session').Session<SessionData>
		cookies: Record<string, string> // all parsed cookies are automatically set from handleSession to avoid overhead
	}

	interface Platform {}

	interface Session extends SessionData {}

	interface Stuff {}
}
