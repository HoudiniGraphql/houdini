// Original file: src/proto/configServer.proto

import type { Value as _google_protobuf_Value, Value__Output as _google_protobuf_Value__Output } from '../google/protobuf/Value';
import type { ScalarDefinition as _houdini_ScalarDefinition, ScalarDefinition__Output as _houdini_ScalarDefinition__Output } from '../houdini/ScalarDefinition';
import type { TypeConfig as _houdini_TypeConfig, TypeConfig__Output as _houdini_TypeConfig__Output } from '../houdini/TypeConfig';
import type { WatchSchemaConfig as _houdini_WatchSchemaConfig, WatchSchemaConfig__Output as _houdini_WatchSchemaConfig__Output } from '../houdini/WatchSchemaConfig';
import type { RouterConfig as _houdini_RouterConfig, RouterConfig__Output as _houdini_RouterConfig__Output } from '../houdini/RouterConfig';
import type { RuntimeScalar as _houdini_RuntimeScalar, RuntimeScalar__Output as _houdini_RuntimeScalar__Output } from '../houdini/RuntimeScalar';
import type { Long } from '@grpc/proto-loader';

// Original file: src/proto/configServer.proto

export const _houdini_StaticConfig_FragmentMasking = {
  FRAGMENT_MASKING_UNSPECIFIED: 'FRAGMENT_MASKING_UNSPECIFIED',
  ENABLE: 'ENABLE',
  DISABLE: 'DISABLE',
} as const;

export type _houdini_StaticConfig_FragmentMasking =
  | 'FRAGMENT_MASKING_UNSPECIFIED'
  | 0
  | 'ENABLE'
  | 1
  | 'DISABLE'
  | 2

export type _houdini_StaticConfig_FragmentMasking__Output = typeof _houdini_StaticConfig_FragmentMasking[keyof typeof _houdini_StaticConfig_FragmentMasking]

// Original file: src/proto/configServer.proto

export const _houdini_StaticConfig_ListPosition = {
  LIST_POSITION_UNSPECIFIED: 'LIST_POSITION_UNSPECIFIED',
  APPEND: 'APPEND',
  PREPEND: 'PREPEND',
} as const;

export type _houdini_StaticConfig_ListPosition =
  | 'LIST_POSITION_UNSPECIFIED'
  | 0
  | 'APPEND'
  | 1
  | 'PREPEND'
  | 2

export type _houdini_StaticConfig_ListPosition__Output = typeof _houdini_StaticConfig_ListPosition[keyof typeof _houdini_StaticConfig_ListPosition]

// Original file: src/proto/configServer.proto

export const _houdini_StaticConfig_ListTarget = {
  LIST_TARGET_UNSPECIFIED: 'LIST_TARGET_UNSPECIFIED',
  ALL: 'ALL',
  NULL: 'NULL',
} as const;

export type _houdini_StaticConfig_ListTarget =
  | 'LIST_TARGET_UNSPECIFIED'
  | 0
  | 'ALL'
  | 1
  | 'NULL'
  | 2

export type _houdini_StaticConfig_ListTarget__Output = typeof _houdini_StaticConfig_ListTarget[keyof typeof _houdini_StaticConfig_ListTarget]

// Original file: src/proto/configServer.proto

export const _houdini_StaticConfig_LogLevel = {
  LOG_LEVEL_UNSPECIFIED: 'LOG_LEVEL_UNSPECIFIED',
  QUIET: 'QUIET',
  FULL: 'FULL',
  SUMMARY: 'SUMMARY',
  SHORT_SUMMARY: 'SHORT_SUMMARY',
} as const;

export type _houdini_StaticConfig_LogLevel =
  | 'LOG_LEVEL_UNSPECIFIED'
  | 0
  | 'QUIET'
  | 1
  | 'FULL'
  | 2
  | 'SUMMARY'
  | 3
  | 'SHORT_SUMMARY'
  | 4

export type _houdini_StaticConfig_LogLevel__Output = typeof _houdini_StaticConfig_LogLevel[keyof typeof _houdini_StaticConfig_LogLevel]

// Original file: src/proto/configServer.proto

export const _houdini_StaticConfig_ModuleType = {
  MODULE_TYPE_UNSPECIFIED: 'MODULE_TYPE_UNSPECIFIED',
  ESM: 'ESM',
  COMMONJS: 'COMMONJS',
} as const;

export type _houdini_StaticConfig_ModuleType =
  | 'MODULE_TYPE_UNSPECIFIED'
  | 0
  | 'ESM'
  | 1
  | 'COMMONJS'
  | 2

export type _houdini_StaticConfig_ModuleType__Output = typeof _houdini_StaticConfig_ModuleType[keyof typeof _houdini_StaticConfig_ModuleType]

// Original file: src/proto/configServer.proto

export const _houdini_StaticConfig_PaginateMode = {
  PAGINATE_MODE_UNSPECIFIED: 'PAGINATE_MODE_UNSPECIFIED',
  INFINITE: 'INFINITE',
  SINGLE_PAGE: 'SINGLE_PAGE',
} as const;

export type _houdini_StaticConfig_PaginateMode =
  | 'PAGINATE_MODE_UNSPECIFIED'
  | 0
  | 'INFINITE'
  | 1
  | 'SINGLE_PAGE'
  | 2

export type _houdini_StaticConfig_PaginateMode__Output = typeof _houdini_StaticConfig_PaginateMode[keyof typeof _houdini_StaticConfig_PaginateMode]

export interface StaticConfig {
  'include'?: (string)[];
  'exclude'?: (string)[];
  'schema'?: (_google_protobuf_Value | null);
  'scalars'?: ({[key: string]: _houdini_ScalarDefinition});
  'definitionsPath'?: (string);
  'module'?: (_houdini_StaticConfig_ModuleType);
  'cacheBufferSize'?: (number);
  'defaultCachePolicy'?: (string);
  'defaultPartial'?: (boolean);
  'defaultLifetime'?: (number | string | Long);
  'defaultListPosition'?: (_houdini_StaticConfig_ListPosition);
  'defaultListTarget'?: (_houdini_StaticConfig_ListTarget);
  'defaultPaginateMode'?: (_houdini_StaticConfig_PaginateMode);
  'suppressPaginationDeduplication'?: (boolean);
  'defaultKeys'?: (string)[];
  'types'?: ({[key: string]: _houdini_TypeConfig});
  'logLevel'?: (_houdini_StaticConfig_LogLevel);
  'defaultFragmentMasking'?: (_houdini_StaticConfig_FragmentMasking);
  'watchSchema'?: (_houdini_WatchSchemaConfig | null);
  'persistedQueriesPath'?: (string);
  'projectDir'?: (string);
  'runtimeDir'?: (string);
  'router'?: (_houdini_RouterConfig | null);
  'runtimeScalars'?: ({[key: string]: _houdini_RuntimeScalar});
}

export interface StaticConfig__Output {
  'include': (string)[];
  'exclude': (string)[];
  'schema': (_google_protobuf_Value__Output | null);
  'scalars': ({[key: string]: _houdini_ScalarDefinition__Output});
  'definitionsPath': (string);
  'module': (_houdini_StaticConfig_ModuleType__Output);
  'cacheBufferSize': (number);
  'defaultCachePolicy': (string);
  'defaultPartial': (boolean);
  'defaultLifetime': (string);
  'defaultListPosition': (_houdini_StaticConfig_ListPosition__Output);
  'defaultListTarget': (_houdini_StaticConfig_ListTarget__Output);
  'defaultPaginateMode': (_houdini_StaticConfig_PaginateMode__Output);
  'suppressPaginationDeduplication': (boolean);
  'defaultKeys': (string)[];
  'types': ({[key: string]: _houdini_TypeConfig__Output});
  'logLevel': (_houdini_StaticConfig_LogLevel__Output);
  'defaultFragmentMasking': (_houdini_StaticConfig_FragmentMasking__Output);
  'watchSchema': (_houdini_WatchSchemaConfig__Output | null);
  'persistedQueriesPath': (string);
  'projectDir': (string);
  'runtimeDir': (string);
  'router': (_houdini_RouterConfig__Output | null);
  'runtimeScalars': ({[key: string]: _houdini_RuntimeScalar__Output});
}
