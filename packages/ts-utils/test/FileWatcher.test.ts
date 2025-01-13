import { describe, expect, it } from 'bun:test';

import { FileSystem } from '@effect/platform';
import { BunContext } from '@effect/platform-bun';
import {
  Cause,
  Console,
  Effect,
  flow,
  Logger,
} from 'effect';

import { FileWatcherMap } from '@astal-config/ts-utils';

describe('FileWatcher', () => {
  it('should watch files', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        // const scope = yield* Scope.make();

        const ref = yield* FileWatcherMap.ref();
        const scope = yield* FileWatcherMap.add(ref, directory);

        yield* Effect.log("Created temporary file:", yield* fs.makeTempFile({ directory }));

        // allow watcher to catch the change
        yield* Effect.sleep('250 millis');

        yield* FileWatcherMap.remove(ref, scope)

        yield* Effect.sleep('250 millis');
        yield* Effect.log("Created temporary file:", yield* fs.makeTempFile({ directory }));
        yield* Effect.sleep('250 millis');
      }).pipe(
        Effect.scoped,
        Effect.provide(BunContext.layer),
        Effect.sandbox,
        Effect.tapErrorCause(flow(Cause.pretty, Effect.logFatal)),
        Effect.provide(Logger.structured),
      ),
    ));
});
