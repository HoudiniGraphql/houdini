import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { ConfigServerClient as _houdini_ConfigServerClient, ConfigServerDefinition as _houdini_ConfigServerDefinition } from './houdini/ConfigServer';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  google: {
    protobuf: {
      ListValue: MessageTypeDefinition
      NullValue: EnumTypeDefinition
      Struct: MessageTypeDefinition
      Value: MessageTypeDefinition
    }
  }
  houdini: {
    ConfigServer: SubtypeConstructor<typeof grpc.Client, _houdini_ConfigServerClient> & { service: _houdini_ConfigServerDefinition }
    GetConfigRequest: MessageTypeDefinition
    PluginConfigRequest: MessageTypeDefinition
    RouterConfig: MessageTypeDefinition
    RuntimeScalar: MessageTypeDefinition
    ScalarDefinition: MessageTypeDefinition
    StaticConfig: MessageTypeDefinition
    TypeConfig: MessageTypeDefinition
    WatchSchemaConfig: MessageTypeDefinition
  }
}

