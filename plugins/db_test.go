package plugins

import (
	"context"
	"testing"
)

// FKs are deferred, so a violation is only reported at commit. both backends
// have to hand that error back, or the transaction rolls back while the
// pipeline step reports success
func TestTransaction_reportsDeferredConstraintViolation(t *testing.T) {
	ctx := context.Background()

	db, err := NewTestPool[struct{}]()
	if err != nil {
		t.Fatalf("failed to create test pool: %v", err)
	}
	defer db.Close()

	if err := db.ExecQuery(ctx, `CREATE TABLE parents (id INTEGER PRIMARY KEY)`, nil); err != nil {
		t.Fatalf("failed to create parents: %v", err)
	}
	if err := db.ExecQuery(ctx, `
		CREATE TABLE children (
			id INTEGER PRIMARY KEY,
			parent INTEGER NOT NULL,
			FOREIGN KEY (parent) REFERENCES parents(id)
		)
	`, nil); err != nil {
		t.Fatalf("failed to create children: %v", err)
	}

	conn, err := db.Take(ctx)
	if err != nil {
		t.Fatalf("failed to take a connection: %v", err)
	}
	defer db.Put(conn)

	commit := db.Transaction(conn)

	insert, err := conn.Prepare(`INSERT INTO children (parent) VALUES (12)`)
	if err != nil {
		t.Fatalf("failed to prepare insert: %v", err)
	}
	defer insert.Finalize()
	if err := db.ExecStatement(insert, nil); err != nil {
		t.Fatalf("the insert must be accepted until the transaction commits: %v", err)
	}

	var commitErr error
	commit(&commitErr)
	if commitErr == nil {
		t.Fatal("committing a transaction with a dangling foreign key must return an error")
	}
}
