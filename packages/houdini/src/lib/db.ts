import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase } from 'sql.js'

export type Params = Record<string, any> | any[]

export interface Db {
	readonly filepath: string
	exec(sql: string): void
	run(sql: string, params?: Params): void
	get<T extends Record<string, any> = Record<string, any>>(
		sql: string,
		params?: Params
	): T | undefined
	all<T extends Record<string, any> = Record<string, any>>(sql: string, params?: Params): T[]
	rowsModified(): number
	// SqlJsDb: export in-memory db to disk so Go can read it. NativeDb: no-op (WAL file is always current).
	flush(): void
	// SqlJsDb: re-open from disk to see what Go wrote. NativeDb: no-op (live connection sees Go writes via WAL).
	reload(): void
	close(): void
}

// ─── sql.js implementation (WebContainers / HOUDINI_PLATFORM=wasm) ────────────

class SqlJsDb implements Db {
	private _db: SqlJsDatabase
	private _SQL: Awaited<ReturnType<typeof initSqlJs>>
	readonly filepath: string
	private _lastRowsModified = 0

	constructor(db: SqlJsDatabase, SQL: Awaited<ReturnType<typeof initSqlJs>>, filepath: string) {
		this._db = db
		this._SQL = SQL
		this.filepath = filepath
	}

	exec(sql: string): void {
		this._db.exec(sql)
	}

	run(sql: string, params?: Params): void {
		this._db.run(sql, params as any)
		this._lastRowsModified = this._db.getRowsModified()
	}

	get<T extends Record<string, any>>(sql: string, params?: Params): T | undefined {
		const stmt = this._db.prepare(sql)
		if (params !== undefined) stmt.bind(params as any)
		const row = stmt.step() ? (stmt.getAsObject() as T) : undefined
		stmt.free()
		return row
	}

	all<T extends Record<string, any>>(sql: string, params?: Params): T[] {
		const stmt = this._db.prepare(sql)
		if (params !== undefined) stmt.bind(params as any)
		const rows: T[] = []
		while (stmt.step()) rows.push(stmt.getAsObject() as T)
		stmt.free()
		return rows
	}

	rowsModified(): number {
		return this._lastRowsModified
	}

	flush(): void {
		if (!this.filepath || this.filepath === ':memory:') return
		const data = this._db.export()
		mkdirSync(dirname(this.filepath), { recursive: true })
		writeFileSync(this.filepath, Buffer.from(data))
	}

	reload(): void {
		if (!this.filepath || this.filepath === ':memory:') return
		this._db.close()
		this._db = existsSync(this.filepath)
			? new this._SQL.Database(new Uint8Array(readFileSync(this.filepath)))
			: new this._SQL.Database()
		this._db.run('PRAGMA journal_mode = DELETE')
		this._db.run('PRAGMA foreign_keys = ON')
		this._db.run('PRAGMA defer_foreign_keys = ON')
	}

	close(): void {
		this._db.close()
	}
}

// ─── native implementation (Node.js via node:sqlite, or Bun via bun:sqlite) ──

class NativeDb implements Db {
	private _conn: any
	private _lastChanges = 0
	readonly filepath: string

	constructor(conn: any, filepath: string) {
		this._conn = conn
		this.filepath = filepath
	}

	exec(sql: string): void {
		this._conn.exec(sql)
	}

	run(sql: string, params?: Params): void {
		const stmt = this._conn.prepare(sql)
		const result =
			params === undefined
				? stmt.run()
				: Array.isArray(params)
					? stmt.run(...params)
					: stmt.run(this._norm(params))
		this._lastChanges = result?.changes ?? 0
	}

	get<T extends Record<string, any>>(sql: string, params?: Params): T | undefined {
		const stmt = this._conn.prepare(sql)
		return (
			params === undefined
				? stmt.get()
				: Array.isArray(params)
					? stmt.get(...params)
					: stmt.get(this._norm(params))
		) as T | undefined
	}

	all<T extends Record<string, any>>(sql: string, params?: Params): T[] {
		const stmt = this._conn.prepare(sql)
		return (
			params === undefined
				? stmt.all()
				: Array.isArray(params)
					? stmt.all(...params)
					: stmt.all(this._norm(params))
		) as T[]
	}

	rowsModified(): number {
		return this._lastChanges
	}

	// WAL-mode file connection is always current — no need to flush or reload.
	flush(): void {}
	reload(): void {}

	close(): void {
		this._conn.close()
	}

	// node:sqlite and bun:sqlite expect named params without the leading $ prefix,
	// e.g. { name: val } for SQL $name. Strip it so callers can use { $name: val }
	// consistently across both sql.js and native backends.
	private _norm(params: Params): any {
		if (Array.isArray(params)) return params
		const out: Record<string, any> = {}
		for (const [k, v] of Object.entries(params)) {
			out[k.startsWith('$') ? k.slice(1) : k] = v
		}
		return out
	}
}

// ─── factory ─────────────────────────────────────────────────────────────────

export async function openDb(filepath: string): Promise<Db> {
	if (process.env.HOUDINI_PLATFORM === 'wasm') {
		const SQL = await initSqlJs()
		let db: SqlJsDatabase
		if (filepath !== ':memory:' && existsSync(filepath)) {
			db = new SQL.Database(new Uint8Array(readFileSync(filepath)))
		} else {
			db = new SQL.Database()
		}
		db.run('PRAGMA journal_mode = DELETE')
		db.run('PRAGMA foreign_keys = ON')
		db.run('PRAGMA defer_foreign_keys = ON')
		return new SqlJsDb(db, SQL, filepath)
	}

	let conn: any
	if (process.versions?.bun) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore — bun:sqlite is not in the standard TS lib
		const { Database } = await import('bun:sqlite')
		conn = new Database(filepath, { create: true })
	} else {
		const { DatabaseSync } = await import('node:sqlite')
		conn = new DatabaseSync(filepath)
	}
	conn.exec('PRAGMA journal_mode = WAL')
	conn.exec('PRAGMA synchronous = off')
	conn.exec('PRAGMA foreign_keys = ON')
	conn.exec('PRAGMA defer_foreign_keys = ON')
	return new NativeDb(conn, filepath)
}
