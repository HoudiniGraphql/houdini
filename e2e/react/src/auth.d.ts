// the session shape for the progressively-enhanced auth e2e: a login mutation marked @session
// writes a whole { user } object here (Houdini signs the entire subtree), and useSession reads
// it back.
declare global {
	namespace App {
		interface Session {
			user?: { id: string; username: string }
			theme?: string
		}
	}
}

export {}
