package schema_test

import (
	"context"
	"path/filepath"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestInputTypeDefinitions(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
				enum MyEnum {
					Value1
					Value2
				}
				enum Status {
					ACTIVE
					INACTIVE
				}
				enum Priority {
					HIGH
					MEDIUM
					LOW
				}
				input UserFilter {
					middle: NestedUserFilter
					listRequired: [String!]!
					nullList: [String]
					recursive: UserFilter
					enum: MyEnum
				}

				input NestedUserFilter {
					id: ID!
					firstName: String!
					admin: Boolean
					age: Int
					weight: Float
				}

				input TaskFilter {
					status: Status
					priority: Priority
					backupStatus: Status
				}

				input SimpleFilter {
					name: String
					age: Int
					active: Boolean
				}
    `,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "generates input type definitions with enum import deduplication",
				Pass: true,
			},
		},
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			require.NoError(t, err)

			// we need to look at the input definitions file and confirm that we generated the correct types
			targetPath := filepath.Join(config.DefinitionsDirectory(), "inputs.ts")

			expected := tests.Dedent(`
				import { MyEnum$options, Priority$options, Status$options } from './enums.js';

				type ValueOf<T> = T[keyof T];

				export type NestedUserFilter = {
				    admin?: boolean | null | undefined;
				    age?: number | null | undefined;
				    firstName: string;
				    id: string | number;
				    weight?: number | null | undefined;
				};

				export type SimpleFilter = {
				    active?: boolean | null | undefined;
				    age?: number | null | undefined;
				    name?: string | null | undefined;
				};

				export type TaskFilter = {
				    backupStatus?: Status$options | null | undefined;
				    priority?: Priority$options | null | undefined;
				    status?: Status$options | null | undefined;
				};

				export type UserFilter = {
				    enum?: MyEnum$options | null | undefined;
				    listRequired: (string)[];
				    middle?: NestedUserFilter | null | undefined;
				    nullList?: (string | null)[] | null | undefined;
				    recursive?: UserFilter | null | undefined;
				};
			`)

			found, err := afero.ReadFile(plugin.Fs, targetPath)
			require.NoError(t, err)

			require.Equal(t, expected, string(found))
		},
	})
}
