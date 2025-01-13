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

        const scope = yield* FileWatcherMap.add(directory);

        yield* Effect.log('250 millis');
        yield* Console.log(yield* fs.makeTempFile({ directory }));
        yield* Effect.log('250 millis');

        yield* FileWatcherMap.remove(scope);

        yield* Effect.log('250 millis');
        yield* Console.log(yield* fs.makeTempFile({ directory }));
        yield* Effect.log('250 millis');

        // const n = yield* Fiber.join(fiber).pipe(Effect.sandbox, Effect.merge);
        // expect(Cause.isInterrupted(rootCause(n as Cause.Cause<never>))).toBeTrue();
      }).pipe(
        FileWatcherMap.provide(FileWatcherMap.ref()),
        Effect.scoped,
        Effect.provide(BunContext.layer),
          Effect.provide(Logger.structured),
        Effect.sandbox,
        Effect.tapErrorCause(flow(Cause.pretty, Effect.logFatal)),
      ),
    ));
});
