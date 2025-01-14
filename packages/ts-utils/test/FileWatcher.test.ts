import { describe, expect, it } from 'bun:test';

import { FileSystem } from '@effect/platform';
import { BunContext } from '@effect/platform-bun';
import { Cause, Effect, flow, Logger } from 'effect';

import { FileWatcherMap } from '@astal-config/ts-utils';

describe('FileWatcher', () => {
  it('should watch files', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();

        const ref = yield* FileWatcherMap.make();
        const scope = yield* FileWatcherMap.add(ref, directory, Effect.log);

        yield* Effect.log('Created temporary file:', yield* fs.makeTempFile({ directory }));

        // allow watcher to catch the change
        yield* Effect.sleep('250 millis');

        yield* FileWatcherMap.remove(ref, scope);
      }).pipe(
        Effect.scoped,
        Effect.provide(BunContext.layer),
        Effect.sandbox,
        Effect.tapErrorCause(flow(Cause.pretty, Effect.logFatal)),
        Effect.provide(Logger.structured),
      ),
    ));
});
