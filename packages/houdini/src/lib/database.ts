export const create_schema = `
-- Schema Definition Tables
CREATE TABLE types (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'SCALAR', 'INPUT')),
    description TEXT
);

CREATE TABLE type_modifiers (
    id INTEGER PRIMARY KEY,
    parent_id INTEGER,
    base_type_name TEXT,
    is_non_null BOOLEAN NOT NULL DEFAULT FALSE,
    is_list BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (parent_id) REFERENCES type_modifiers(id)
);

CREATE TABLE type_fields (
    id INTEGER PRIMARY KEY,
    type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type_modifier_id INTEGER NOT NULL,
    description TEXT,
    FOREIGN KEY (type_id) REFERENCES types(id),
    FOREIGN KEY (type_modifier_id) REFERENCES type_modifiers(id),
    UNIQUE (type_id, name)
);

CREATE TABLE field_argument_definitions (
    id INTEGER PRIMARY KEY,
    field_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type_modifier_id INTEGER NOT NULL,
    default_value TEXT,
    description TEXT,
    FOREIGN KEY (field_id) REFERENCES type_fields(id),
    FOREIGN KEY (type_modifier_id) REFERENCES type_modifiers(id),
    UNIQUE (field_id, name)
);

CREATE TABLE input_fields (
    id INTEGER PRIMARY KEY,
    type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type_modifier_id INTEGER NOT NULL,
    default_value TEXT,
    description TEXT,
    FOREIGN KEY (type_id) REFERENCES types(id),
    FOREIGN KEY (type_modifier_id) REFERENCES type_modifiers(id),
    UNIQUE (type_id, name)
);

CREATE TABLE enum_values (
    id INTEGER PRIMARY KEY,
    type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (type_id) REFERENCES types(id),
    UNIQUE (type_id, name)
);

CREATE TABLE implemented_interfaces (
    type_id INTEGER NOT NULL,
    interface_type_id INTEGER NOT NULL,
    FOREIGN KEY (type_id) REFERENCES types(id),
    FOREIGN KEY (interface_type_id) REFERENCES types(id),
    PRIMARY KEY (type_id, interface_type_id)
);

CREATE TABLE union_member_types (
    union_type_id INTEGER NOT NULL,
    member_type_id INTEGER NOT NULL,
    FOREIGN KEY (union_type_id) REFERENCES types(id),
    FOREIGN KEY (member_type_id) REFERENCES types(id),
    PRIMARY KEY (union_type_id, member_type_id)
);


-- Type system indices
CREATE INDEX idx_types_name ON types(name);

CREATE INDEX idx_type_modifiers_parent ON type_modifiers(parent_id);
CREATE INDEX idx_type_modifiers_base_type ON type_modifiers(base_type_name);

CREATE INDEX idx_type_fields_type ON type_fields(type_id);
CREATE INDEX idx_type_fields_type_modifier ON type_fields(type_modifier_id);
CREATE INDEX idx_type_fields_name ON type_fields(name);
CREATE INDEX idx_type_fields_type_name ON type_fields(type_id, name);

CREATE INDEX idx_field_arg_defs_field ON field_argument_definitions(field_id);
CREATE INDEX idx_field_arg_defs_name ON field_argument_definitions(name);
CREATE INDEX idx_field_arg_defs_type_modifier ON field_argument_definitions(type_modifier_id);

CREATE INDEX idx_input_fields_type ON input_fields(type_id);
CREATE INDEX idx_input_fields_name ON input_fields(name);
CREATE INDEX idx_input_fields_type_modifier ON input_fields(type_modifier_id);

CREATE INDEX idx_enum_values_type ON enum_values(type_id);
CREATE INDEX idx_enum_values_name ON enum_values(name);

CREATE INDEX idx_implemented_interfaces_type ON implemented_interfaces(type_id);
CREATE INDEX idx_implemented_interfaces_interface ON implemented_interfaces(interface_type_id);

CREATE INDEX idx_union_members_union ON union_member_types(union_type_id);
CREATE INDEX idx_union_members_member ON union_member_types(member_type_id);

-- Document Tables

CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE selections (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL,
    parent_id INTEGER,
    field_name TEXT NOT NULL,
    type_id INTEGER NOT NULL,
    alias TEXT,
    path_index INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (parent_id) REFERENCES selections(id)
    FOREIGN KEY (type_id) REFERENCES types(id)
);

CREATE TABLE field_arguments (
    id INTEGER PRIMARY KEY,
    selection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value_type TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id)
);

CREATE TABLE directives (
    id INTEGER PRIMARY KEY,
    selection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id)
);

CREATE TABLE directive_arguments (
    id INTEGER PRIMARY KEY,
    directive_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value_type TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (directive_id) REFERENCES directives(id)
);

CREATE INDEX idx_documents_name ON documents(name);

CREATE INDEX idx_selections_document ON selections(document_id);
CREATE INDEX idx_selections_parent ON selections(parent_id);
CREATE INDEX idx_selections_field_name ON selections(field_name);
CREATE INDEX idx_selections_hierarchy ON selections(document_id, parent_id, path_index);

CREATE INDEX idx_field_arguments_selection ON field_arguments(selection_id);
CREATE INDEX idx_field_arguments_name ON field_arguments(name);

CREATE INDEX idx_directives_selection ON directives(selection_id);
CREATE INDEX idx_directives_name ON directives(name);

CREATE INDEX idx_directive_arguments_directive ON directive_arguments(directive_id);
CREATE INDEX idx_directive_arguments_name ON directive_arguments(name);
`

// Query to Load a Selection Tree
//
// WITH RECURSIVE selection_tree AS (
//     -- Base case: get root selection
//     SELECT
//         s.id,
//         s.field_name,
//         s.alias,
//         s.path_index,
//         0 as depth,
//         s.field_name as path
//     FROM selections s
//     WHERE s.id = ? -- your starting selection id

//     UNION ALL

//     -- Recursive case: get all children
//     SELECT
//         child.id,
//         child.field_name,
//         child.alias,
//         child.path_index,
//         st.depth + 1,
//         st.path || '.' || child.field_name
//     FROM selections child
//     JOIN selection_tree st ON child.parent_id = st.id
// )

// Recursive Query to Load Type Modifier Tree
// type_modifier_tree AS (
//     -- Base case: get leaf type modifier
//     SELECT
//         tm.id,
//         tm.parent_id,
//         tm.base_type_name,
//         tm.is_non_null,
//         1 as level,
//         CASE
//             WHEN tm.is_non_null THEN base_type_name || '!'
//             ELSE base_type_name
//         END as full_type
//     FROM type_modifiers tm
//     WHERE tm.id = ? -- your starting type_modifier_id
//     AND tm.base_type_name IS NOT NULL -- leaf node

//     UNION ALL

//     -- Recursive case: wrap in list modifiers
//     SELECT
//         tm.id,
//         tm.parent_id,
//         tm.base_type_name,
//         tm.is_non_null,
//         tmt.level + 1,
//         CASE
//             WHEN tm.is_non_null THEN '[' || tmt.full_type || ']!'
//             ELSE '[' || tmt.full_type || ']'
//         END
//     FROM type_modifiers tm
//     JOIN type_modifier_tree tmt ON tm.id = tmt.parent_id
// )
