// the session shape for the progressively-enhanced auth e2e: a login mutation marked @session
// writes a whole { user } object here (Houdini signs the entire subtree), and useSession reads
// it back.
declare global {
	namespace App {
		interface Session {
			user?: { id: string; username: string }
			theme?: string
			// established by the first-class OAuth flow (onSignIn in src/server/+config)
			userId?: string
			email?: string
		}
	}
}

export {}
