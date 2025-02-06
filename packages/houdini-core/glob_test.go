package main

import (
	"testing"
)

func TestGlob(t *testing.T) {
	table := []struct {
		Name      string
		Pattern   string
		Matches   []string
		Unmatches []string
	}{
		{
			Name:    "multiple extensions",
			Pattern: "src/**/*.{js,jsx,ts,tsx}",
			Matches: []string{
				"src/foo.js",
				"src/components/Button.jsx",
				"src/utils/helpers/format.ts",
				"src/pages/index.tsx",
			},
			Unmatches: []string{
				"src/styles.css",
			},
		},
	}

	for _, row := range table {
		t.Run(row.Name, func(t *testing.T) {
			// build a new glob pattern
			glob, err := newGlob(row.Pattern, ".")
			if err != nil {
				t.Errorf("Error creating glob: %v", err)
			}

			for _, path := range row.Matches {
				if !glob.Match(path) {
					t.Errorf("Expected %s to match %s", path, row.Pattern)
				}
			}
			for _, path := range row.Unmatches {
				if glob.Match(path) {
					t.Errorf("Expected %s to not match %s", path, row.Pattern)
				}
			}

		})
	}

}
