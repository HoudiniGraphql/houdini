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
	insertDocument, err := conn.Prepare(
		"INSERT INTO documents (name, raw_document, kind, type_condition) VALUES ($name, $raw_document, $kind, $type_condition)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariable, err := conn.Prepare(
		"INSERT INTO document_variables (document, name, type, type_modifiers, default_value, row, column) VALUES ($document, $name, $type, $type_modifiers, $default_value, $row, $column)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelection, err := conn.Prepare(
		"INSERT INTO selections (field_name, alias, kind, type) VALUES ($field_name, $alias, $kind, $type)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionArgument, err := conn.Prepare(
		"INSERT INTO selection_arguments (selection_id, name, value, row, column, field_argument, document) VALUES ($selection_id, $name, $value, $row, $column, $field_argument, $document)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertArgumentValue, err := conn.Prepare(
		"INSERT INTO argument_values (kind, raw, row, column, expected_type, expected_type_modifiers, document) VALUES ($kind, $raw, $row, $column, $type, $type_modifiers, $document)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertArgumentValueChildren, err := conn.Prepare(
		"INSERT INTO argument_value_children (name, parent, value, row, column, document) VALUES ($name, $parent, $value, $row, $column, $document)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionRef, err := conn.Prepare(
		"INSERT INTO selection_refs (parent_id, child_id, document, row, column, path_index) VALUES ($parent_id, $child_id, $document, $row, $column, $path_index)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionDirective, err := conn.Prepare(
		"INSERT INTO selection_directives (selection_id, directive, row, column) VALUES ($selection_id, $directive, $row, $column)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionDirectiveArgument, err := conn.Prepare(
		"INSERT INTO selection_directive_arguments (parent, name, value, document) VALUES ($parent, $name, $value, $document)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentDirective, err := conn.Prepare(
		"INSERT INTO document_directives (document, directive, row, column) VALUES ($document, $directive, $row, $column)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentDirectiveArgument, err := conn.Prepare(
		"INSERT INTO document_directive_arguments (parent, name, value) VALUES ($parent, $name, $value)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariableDirective, err := conn.Prepare(
		"INSERT INTO document_variable_directives (parent, directive, row, column) VALUES ($parent, $directive, $row, $column)",
	)
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariableDirectiveArgument, err := conn.Prepare(
		"INSERT INTO document_variable_directive_arguments (parent, name, value) VALUES ($parent, $name, $value)",
	)
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
