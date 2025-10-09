package collected

// Document represents a GraphQL document with its selections and metadata
type Document struct {
	ID                  int64
	Name                string
	Kind                string // "query", "mutation", "subscription", or "fragment"
	TypeCondition       string
	Hash                string
	Variables           []*OperationVariable
	Selections          []*Selection
	Directives          []*Directive
	ReferencedFragments []string
	UnusedVariables     []string
}

// Selection represents a field selection in a GraphQL document
type Selection struct {
	FieldName      string
	Alias          *string
	FieldType      string
	FragmentRef    *string
	TypeModifiers  *string
	Kind           string
	Description    *string
	Visible        bool
	Internal       bool
	List           *List
	Paginated      bool
	Arguments      []*Argument
	Directives     []*Directive
	Children       []*Selection
	ComponentField *ComponentFieldSpec
}

// List represents list metadata for a field
type List struct {
	Name             string
	Type             string
	Connection       bool
	Paginated        bool
	SupportsForward  bool
	SupportsBackward bool
	PageSize         int
	Mode             string
	TargetType       string
	Embedded         bool
	CursorType       string
}

// OperationVariable represents a variable in a GraphQL operation
type OperationVariable struct {
	Name           string
	Type           string
	TypeModifiers  string
	DefaultValue   *ArgumentValue
	DefaultValueID *int64
	Directives     []*Directive
}

// Argument represents an argument in a GraphQL field or directive
type Argument struct {
	Name       string `json:"name"`
	ValueID    *int64 `json:"value"`
	Value      *ArgumentValue
	Directives []*Directive
}

// Directive represents a directive in a GraphQL document
type Directive struct {
	Internal  int        `json:"internal"`
	Name      string     `json:"name"`
	Arguments []*Argument `json:"arguments"`
}

// ArgumentValue represents the value of an argument
type ArgumentValue struct {
	Kind     string
	Raw      string
	Children []*ArgumentValueChildren
}

// ArgumentValueChildren represents nested argument values
type ArgumentValueChildren struct {
	Name  string
	Value *ArgumentValue
}

// ComponentFieldSpec represents component field metadata
type ComponentFieldSpec struct {
	Prop      string
	Type      string
	Field     string
	Fragment  string
	Variables map[string]any
}

// Documents represents the complete collection of documents and metadata
type Documents struct {
	TaskDocuments []string
	Selections    map[string]*Document
	// PossibleTypes maps abstract types to concrete types that implement them
	PossibleTypes map[string]map[string]bool
	// Implementations maps concrete types to the abstract types it implements (its the inverse of PossibleTypes)
	Implementations map[string]map[string]bool
	// InputTypes holds a description of every field of every type used as an input
	// for every collected doc
	InputTypes map[string]map[string]string

	// EnumValues holds a list of enum values for every enum type used as an input
	EnumValues map[string][]string
}

// Clone creates a copy of the Selection
func (s *Selection) Clone(includeChildren bool) *Selection {
	clone := &Selection{
		FieldName:      s.FieldName,
		FieldType:      s.FieldType,
		Kind:           s.Kind,
		Visible:        s.Visible,
		Internal:       s.Internal,
		ComponentField: s.ComponentField,
	}

	// clone pointer fields
	if s.Alias != nil {
		alias := *s.Alias
		clone.Alias = &alias
	}
	if s.FragmentRef != nil {
		frag := *s.FragmentRef
		clone.FragmentRef = &frag
	}
	if s.TypeModifiers != nil {
		mods := *s.TypeModifiers
		clone.TypeModifiers = &mods
	}
	if s.List != nil {
		clone.List = s.List
	}
	if s.Paginated {
		clone.Paginated = true
	}

	// clone Arguments
	if len(s.Arguments) > 0 {
		clone.Arguments = make([]*Argument, len(s.Arguments))
		for i, arg := range s.Arguments {
			if arg != nil {
				argClone := *arg
				clone.Arguments[i] = &argClone
			}
		}
	}

	// clone Directives
	if len(s.Directives) > 0 {
		clone.Directives = make([]*Directive, len(s.Directives))
		for i, dir := range s.Directives {
			if dir != nil {
				dClone := *dir
				clone.Directives[i] = &dClone
			}
		}
	}

	// clone Children (handle cycles)
	if len(s.Children) > 0 && includeChildren {
		clone.Children = make([]*Selection, 0, len(s.Children))
		for _, child := range s.Children {
			if child != nil {
				clone.Children = append(clone.Children, child.Clone(includeChildren))
			}
		}
	}

	return clone
}
