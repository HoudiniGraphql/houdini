/**
 * Coordinates the handoff between houdini dev sessions within one process.
 *
 * A vite restart creates the replacement server (and with it a fresh houdini
 * session: plugin context, database connection, compiler, and Go plugin
 * processes) *before* closing the old server. Without coordination the two
 * sessions overlap on the shared orchestration database: the new session wipes
 * the file and spawns its plugins while the old session's processes still hold
 * it, so plugin registrations collide and the surviving session can end up
 * pointing at plugin processes that no longer exist.
 *
 * This registry is deliberately module-level: its whole purpose is to pass
 * ownership from one plugin-instance generation to the next, which no
 * per-instance state can do. Each dev session registers a dispose callback
 * keyed by its database file; the next session for that file (or the owning
 * server's close event, whichever comes first) runs it exactly once.
 */

type SessionEntry = {
	dispose: () => Promise<void>
}

const sessions = new Map<string, SessionEntry>()

/**
 * Register the active session for a database file. Returns a disposer bound to
 * this registration: it runs the teardown at most once, and removes the
 * registration only if it is still the active one (a replacement session may
 * have already taken the slot).
 */
export function register_session(
	db_file: string,
	dispose: () => Promise<void>
): () => Promise<void> {
	let running: Promise<void> | null = null
	const entry: SessionEntry = {
		dispose: () => {
			running ??= dispose()
			return running
		},
	}
	sessions.set(db_file, entry)
	return () => {
		if (sessions.get(db_file) === entry) {
			sessions.delete(db_file)
		}
		return entry.dispose()
	}
}

/**
 * Dispose whatever session currently owns the database file (no-op when none).
 * A new session calls this before it recreates the database and spawns its own
 * plugin processes.
 */
export async function dispose_active_session(db_file: string): Promise<void> {
	const entry = sessions.get(db_file)
	if (!entry) {
		return
	}
	sessions.delete(db_file)
	await entry.dispose()
}
