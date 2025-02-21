package documents

import "zombiezen.com/go/sqlite"

type DocumentInsertStatements struct {
	InsertDocument                          *sqlite.Stmt
	InsertDocumentVariable                  *sqlite.Stmt
	InsertDocumentVariableDirective         *sqlite.Stmt
	InsertDocumentVariableDirectiveArgument *sqlite.Stmt
	InsertSelection                         *sqlite.Stmt
	InsertSelectionRef                      *sqlite.Stmt
	InsertSelectionArgument                 *sqlite.Stmt
	InsertArgumentValue                     *sqlite.Stmt
	InsertArgumentValueChild                *sqlite.Stmt
	InsertSelectionDirective                *sqlite.Stmt
	InsertSelectionDirectiveArgument        *sqlite.Stmt
	InsertDocumentDirective                 *sqlite.Stmt
	InsertDocumentDirectiveArgument         *sqlite.Stmt
}

func PrepareDocumentInsertStatements(conn *sqlite.Conn) (DocumentInsertStatements, error, func()) {
	insertDocument, err := conn.Prepare("INSERT INTO documents (name, raw_document, kind, type_condition) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariable, err := conn.Prepare("INSERT INTO document_variables (document, name, type, type_modifiers, default_value, row, column) VALUES (?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelection, err := conn.Prepare("INSERT INTO selections (field_name, alias, path_index, kind, type) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionArgument, err := conn.Prepare("INSERT INTO selection_arguments (selection_id, name, value, row, column) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertArgumentValue, err := conn.Prepare("INSERT INTO argument_values (kind, raw, row, column) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertArgumentValueChildren, err := conn.Prepare("INSERT INTO argument_value_children (name, parent, value, row, column) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionRef, err := conn.Prepare("INSERT INTO selection_refs (parent_id, child_id, document, row, column) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionDirective, err := conn.Prepare("INSERT INTO selection_directives (selection_id, directive, row, column) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionDirectiveArgument, err := conn.Prepare("INSERT INTO selection_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentDirective, err := conn.Prepare("INSERT INTO document_directives (document, directive, row, column) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentDirectiveArgument, err := conn.Prepare("INSERT INTO document_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariableDirective, err := conn.Prepare("INSERT INTO operation_variable_directives (parent, directive, row, column) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariableDirectiveArgument, err := conn.Prepare("INSERT INTO operation_variable_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}

	finalize := func() {
		insertDocument.Finalize()
		insertDocumentVariable.Finalize()
		insertSelection.Finalize()
		insertSelectionArgument.Finalize()
		insertSelectionRef.Finalize()
		insertSelectionDirective.Finalize()
		insertSelectionDirectiveArgument.Finalize()
		insertDocumentDirective.Finalize()
		insertDocumentDirectiveArgument.Finalize()
		insertDocumentVariableDirective.Finalize()
		insertDocumentVariableDirectiveArgument.Finalize()
		insertArgumentValue.Finalize()
		insertArgumentValueChildren.Finalize()
	}

	return DocumentInsertStatements{
		InsertDocument:                          insertDocument,
		InsertDocumentVariable:                  insertDocumentVariable,
		InsertDocumentVariableDirective:         insertDocumentVariableDirective,
		InsertDocumentVariableDirectiveArgument: insertDocumentVariableDirectiveArgument,
		InsertSelection:                         insertSelection,
		InsertSelectionArgument:                 insertSelectionArgument,
		InsertArgumentValue:                     insertArgumentValue,
		InsertArgumentValueChild:                insertArgumentValueChildren,
		InsertSelectionRef:                      insertSelectionRef,
		InsertSelectionDirective:                insertSelectionDirective,
		InsertSelectionDirectiveArgument:        insertSelectionDirectiveArgument,
		InsertDocumentDirective:                 insertDocumentDirective,
		InsertDocumentDirectiveArgument:         insertDocumentDirectiveArgument,
	}, nil, finalize
}
