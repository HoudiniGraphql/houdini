// the session shape for the progressively-enhanced auth e2e: a login mutation marked @auth
// writes { token } here, and useSession reads it back.
declare global {
	namespace App {
		interface Session {
			token?: string
		}
	}
}

export {}
