// Original file: src/proto/configServer.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { GetConfigRequest as _houdini_GetConfigRequest, GetConfigRequest__Output as _houdini_GetConfigRequest__Output } from '../houdini/GetConfigRequest';
import type { PluginConfigRequest as _houdini_PluginConfigRequest, PluginConfigRequest__Output as _houdini_PluginConfigRequest__Output } from '../houdini/PluginConfigRequest';
import type { StaticConfig as _houdini_StaticConfig, StaticConfig__Output as _houdini_StaticConfig__Output } from '../houdini/StaticConfig';
import type { Value as _google_protobuf_Value, Value__Output as _google_protobuf_Value__Output } from '../google/protobuf/Value';

export interface ConfigServerClient extends grpc.Client {
  GetConfig(argument: _houdini_GetConfigRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_houdini_StaticConfig__Output>): grpc.ClientUnaryCall;
  GetConfig(argument: _houdini_GetConfigRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_houdini_StaticConfig__Output>): grpc.ClientUnaryCall;
  GetConfig(argument: _houdini_GetConfigRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_houdini_StaticConfig__Output>): grpc.ClientUnaryCall;
  GetConfig(argument: _houdini_GetConfigRequest, callback: grpc.requestCallback<_houdini_StaticConfig__Output>): grpc.ClientUnaryCall;
  getConfig(argument: _houdini_GetConfigRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_houdini_StaticConfig__Output>): grpc.ClientUnaryCall;
  getConfig(argument: _houdini_GetConfigRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_houdini_StaticConfig__Output>): grpc.ClientUnaryCall;
  getConfig(argument: _houdini_GetConfigRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_houdini_StaticConfig__Output>): grpc.ClientUnaryCall;
  getConfig(argument: _houdini_GetConfigRequest, callback: grpc.requestCallback<_houdini_StaticConfig__Output>): grpc.ClientUnaryCall;
  
  GetPluginConfig(argument: _houdini_PluginConfigRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_google_protobuf_Value__Output>): grpc.ClientUnaryCall;
  GetPluginConfig(argument: _houdini_PluginConfigRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_google_protobuf_Value__Output>): grpc.ClientUnaryCall;
  GetPluginConfig(argument: _houdini_PluginConfigRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_google_protobuf_Value__Output>): grpc.ClientUnaryCall;
  GetPluginConfig(argument: _houdini_PluginConfigRequest, callback: grpc.requestCallback<_google_protobuf_Value__Output>): grpc.ClientUnaryCall;
  getPluginConfig(argument: _houdini_PluginConfigRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_google_protobuf_Value__Output>): grpc.ClientUnaryCall;
  getPluginConfig(argument: _houdini_PluginConfigRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_google_protobuf_Value__Output>): grpc.ClientUnaryCall;
  getPluginConfig(argument: _houdini_PluginConfigRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_google_protobuf_Value__Output>): grpc.ClientUnaryCall;
  getPluginConfig(argument: _houdini_PluginConfigRequest, callback: grpc.requestCallback<_google_protobuf_Value__Output>): grpc.ClientUnaryCall;
  
}

export interface ConfigServerHandlers extends grpc.UntypedServiceImplementation {
  GetConfig: grpc.handleUnaryCall<_houdini_GetConfigRequest__Output, _houdini_StaticConfig>;
  
  GetPluginConfig: grpc.handleUnaryCall<_houdini_PluginConfigRequest__Output, _google_protobuf_Value>;
  
}

export interface ConfigServerDefinition extends grpc.ServiceDefinition {
  GetConfig: MethodDefinition<_houdini_GetConfigRequest, _houdini_StaticConfig, _houdini_GetConfigRequest__Output, _houdini_StaticConfig__Output>
  GetPluginConfig: MethodDefinition<_houdini_PluginConfigRequest, _google_protobuf_Value, _houdini_PluginConfigRequest__Output, _google_protobuf_Value__Output>
}
