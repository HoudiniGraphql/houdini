package plugins

// ColumnKind mirrors sqlite column type constants without importing zombiezen.
type ColumnKind int

const (
	ColumnKindNull  ColumnKind = 0
	ColumnKindInt   ColumnKind = 1
	ColumnKindFloat ColumnKind = 2
	ColumnKindText  ColumnKind = 3
	ColumnKindBlob  ColumnKind = 4
)

// Row is the read-only view of a result row, satisfied by *sqlite.Stmt in zombiezen builds
// and by a wrapper in ncruces builds.
type Row interface {
	ColumnText(i int) string
	GetText(col string) string
	ColumnInt(i int) int
	ColumnInt64(i int) int64
	GetInt64(col string) int64
	ColumnBool(i int) bool
	GetBool(col string) bool
	ColumnIsNull(i int) bool
	IsNull(col string) bool
	ColumnType(i int) ColumnKind
}

// Stmt is a prepared statement — used by callers that need manual step/bind control.
type Stmt interface {
	Row
	SetText(param string, value string)
	SetInt64(param string, value int64)
	SetNull(param string)
	SetBool(param string, value bool)
	BindText(i int, value string)
	BindInt64(i int, value int64)
	BindParamCount() int
	BindParamName(i int) string
	Step() (bool, error)
	Reset() error
	ClearBindings() error
	Finalize() error
}

// Conn is an opaque checked-out connection.
type Conn interface {
	// Prepare compiles a SQL query and returns a Stmt.
	Prepare(query string) (Stmt, error)
	// LastInsertRowID returns the row ID of the most recent successful INSERT.
	LastInsertRowID() int64
}
