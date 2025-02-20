package main

import (
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
)

func TestTypesMatch(t *testing.T) {
	tests := []struct {
		Title   string
		TypeStr string
		Values  []struct {
			Title string
			Value *ast.Value
			Pass  bool
		}
	}{
		{
			Title:   "Non-null list of non-null String",
			TypeStr: "[String!]!",
			Values: []struct {
				Title string
				Value *ast.Value
				Pass  bool
			}{
				{
					Title: "null",
					Value: nil,
					Pass:  false,
				},
				{
					Title: "list with null inside",
					Value: &ast.Value{
						Raw:  `["hello", null]`,
						Kind: ast.ListValue,
						Children: ast.ChildValueList{
							&ast.ChildValue{
								Value: &ast.Value{
									Raw:  `"hello"`,
									Kind: ast.StringValue,
								},
							},
							&ast.ChildValue{
								Value: nil,
							},
						},
					},
					Pass: false,
				},
				{
					Title: "list with non-null inside",
					Value: &ast.Value{
						Raw:  `["hello", "world"]`,
						Kind: ast.ListValue,
						Children: ast.ChildValueList{
							&ast.ChildValue{
								Value: &ast.Value{
									Raw:  `"hello"`,
									Kind: ast.StringValue,
								},
							},
							&ast.ChildValue{
								Value: &ast.Value{
									Raw:  `"world"`,
									Kind: ast.StringValue,
								},
							},
						},
					},
					Pass: true,
				},
			},
		},
		{
			Title:   "Non-null Int",
			TypeStr: "Int!",
			Values: []struct {
				Title string
				Value *ast.Value
				Pass  bool
			}{
				{
					Title: "correct",
					Value: &ast.Value{
						Raw:  "123", // no trailing "!" in the literal
						Kind: ast.IntValue,
					},
					Pass: true,
				},
				{
					Title: "nil",
					Value: nil,
					Pass:  false,
				},
			},
		},
		{
			Title:   "List of Int",
			TypeStr: "[Int]",
			Values: []struct {
				Title string
				Value *ast.Value
				Pass  bool
			}{
				{
					Title: "list with correct int literal",
					Value: &ast.Value{
						Raw:  "[1]",
						Kind: ast.ListValue,
						Children: ast.ChildValueList{
							&ast.ChildValue{
								Value: &ast.Value{
									Raw:  "1",
									Kind: ast.IntValue,
								},
							},
						},
					},
					Pass: true,
				},
			},
		},
		{
			Title:   "Nested list of Boolean",
			TypeStr: "[[Boolean]]!",
			Values: []struct {
				Title string
				Value *ast.Value
				Pass  bool
			}{
				{
					Title: "valid nested list",
					Value: &ast.Value{
						Raw:  "[[true, false]]",
						Kind: ast.ListValue,
						Children: ast.ChildValueList{
							&ast.ChildValue{
								Value: &ast.Value{
									Raw:  "[true, false]",
									Kind: ast.ListValue,
									Children: ast.ChildValueList{
										&ast.ChildValue{
											Value: &ast.Value{
												Raw:  "true",
												Kind: ast.BooleanValue,
											},
										},
										&ast.ChildValue{
											Value: &ast.Value{
												Raw:  "false",
												Kind: ast.BooleanValue,
											},
										},
									},
								},
							},
						},
					},
					Pass: true,
				},
				{
					Title: "mismatch inner type",
					Value: &ast.Value{
						Raw:  "[[true, \"false\"]]!",
						Kind: ast.ListValue,
						Children: ast.ChildValueList{
							&ast.ChildValue{
								Value: &ast.Value{
									Raw:  "[true, \"false\"]",
									Kind: ast.ListValue,
									Children: ast.ChildValueList{
										&ast.ChildValue{
											Value: &ast.Value{
												Raw:  "true",
												Kind: ast.BooleanValue,
											},
										},
										&ast.ChildValue{
											Value: &ast.Value{
												Raw:  "\"false\"",
												Kind: ast.StringValue,
											},
										},
									},
								},
							},
						},
					},
					Pass: false,
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.Title, func(t *testing.T) {
			for _, tv := range tc.Values {
				t.Run(tv.Title, func(t *testing.T) {
					got, err := typesMatch(tc.TypeStr, tv.Value)
					if err != nil {
						t.Fatalf("typesMatch(%q, astVal) error: %v", tc.TypeStr, err)
					}
					if got != tv.Pass {
						t.Errorf("typesMatch(%q, astVal) = %v; want %v", tc.TypeStr, got, tv.Pass)
					}
				})
			}
		})
	}
}
