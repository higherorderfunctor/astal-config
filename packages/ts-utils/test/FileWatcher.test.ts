import { describe, expect, it } from 'bun:test';

import { FileSystem } from '@effect/platform';
import { BunContext, BunFileSystem } from '@effect/platform-bun';
import { Cause, Console, Effect, Exit, Fiber, flow, Layer, Match, pipe, Scope, Sink, Stream } from 'effect';

// eslint-disable-next-line import-x/no-relative-packages
import type { layer as ParcelWatchBackend } from '../node_modules/@effect/platform-bun/dist/dts/BunFileSystem/ParcelWatcher.d.ts';
// @ts-expect-error Types imported separately
// eslint-disable-next-line import-x/no-relative-packages
import { layer as _ParcelWatchBackend } from '../node_modules/@effect/platform-node-shared/dist/esm/NodeFileSystem/ParcelWatcher.js';

const ParcelWatcher = _ParcelWatchBackend as typeof ParcelWatchBackend;

Layer.fresh(ParcelWatcher);

const WatchBackend = pipe(
  Effect.acquireRelease(
    pipe(
      Effect.succeed(Layer.fresh(BunFileSystem.layer).pipe(Layer.provide(Layer.fresh(ParcelWatcher)))),
      Effect.tap(() => Console.log('Fresh parcel watcher started')),
    ),
    () => Console.log('Fresh parcel watcher stopped'),
  ),
  Layer.unwrapEffect,
);

const watch = (path: string) =>
  pipe(
    FileSystem.FileSystem,
    Effect.map((fs) => fs.watch(path)),
    Effect.map(Stream.tap(Console.log)),
    Effect.flatMap(Stream.runScoped(Sink.drain)),
    Effect.provide(WatchBackend),
    Effect.fork,
  );

const isInterrupted: <A>(cause: Cause.Cause<A>) => Cause.Cause<A> = flow(
  Match.value,
  Match.when(Cause.isDieType, (_) => (Cause.isCause(_.defect) ? isInterrupted(_.defect) : _)),
  Match.when(Cause.isEmptyType, (_) => _),
  Match.when(Cause.isFailType, (_) => (Cause.isCause(_.error) ? isInterrupted(_.error) : _)),
  Match.when(Cause.isInterruptType, (_) => _),
  Match.when(Cause.isParallelType, (_) => {
    if (Cause.isCause(_.right)) {
      return isInterrupted(_.right);
    }
    if (Cause.isCause(_.left)) {
      return isInterrupted(_.left);
    }
    return _;
  }),
  Match.when(Cause.isSequentialType, (_) => {
    if (Cause.isCause(_.right)) {
      return isInterrupted(_.right);
    }
    if (Cause.isCause(_.left)) {
      return isInterrupted(_.left);
    }
    return _;
  }),
  Match.exhaustive,
);

describe('FileWatcher', () => {
  it('should watch files', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        const scope = yield* Scope.make();

        const fiber = yield* watch(directory).pipe(Effect.provideService(Scope.Scope, scope));

        yield* Effect.sleep('250 millis');
        yield* Console.log(yield* fs.makeTempFile({ directory }));
        yield* Effect.sleep('250 millis');

        yield* Scope.close(scope, Exit.interrupt(fiber.id()));

        yield* Effect.sleep('250 millis');
        yield* Console.log(yield* fs.makeTempFile({ directory }));
        yield* Effect.sleep('250 millis');

        const n = yield* Fiber.join(fiber).pipe(Effect.sandbox, Effect.merge);
        expect(Cause.isInterrupted(isInterrupted(n as Cause.Cause<never>))).toBeTrue();
      }).pipe(
        Effect.scoped,
        Effect.provide(BunContext.layer),
        Effect.sandbox,
        Effect.tapErrorCause(flow(Cause.pretty, Effect.logFatal)),
      ),
    ));
});
