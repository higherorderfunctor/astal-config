import type { Layer } from 'effect';
import { Effect } from 'effect';
import ts from 'typescript';

import * as FileWatcher from './FileWatcher.js';

export class ServerHost extends Effect.Service<ServerHost>()('ServerHost', {
  dependencies: [FileWatcher.layer],
  effect: Effect.gen(function* () {
    const fileWatcher = yield* FileWatcher.FileWatcher;
    const host: ts.server.ServerHost = {
      ...ts.sys,
      clearImmediate,
      clearTimeout,
      setImmediate,
      setTimeout,
      watchDirectory: fileWatcher.stub,
      watchFile: fileWatcher.stub,
    };
    return host;
  }),
}) {}

export const layer: Layer.Layer<ServerHost> = ServerHost.Default;

export const layerNoDeps: Layer.Layer<ServerHost, never, FileWatcher.FileWatcher> =
  ServerHost.DefaultWithoutDependencies;
