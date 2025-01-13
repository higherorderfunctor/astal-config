import { FileSystem } from '@effect/platform';
import { BunFileSystem } from '@effect/platform-bun';
import { PlatformError } from '@effect/platform/Error';
import { Context, Effect, Fiber, flow, HashMap, Layer, Match, Scope, Predicate, SynchronizedRef, Stream, Sink, pipe, ExecutionStrategy, Exit, Cause, Option } from 'effect';
import type ts from 'typescript';

// NOTE: Work around for this file not being exported by @effect/platform-bun
//       It only imports the types.
// eslint-disable-next-line import-x/no-relative-packages
import type { layer as ParcelWatchBackend } from '../node_modules/@effect/platform-bun/dist/dts/BunFileSystem/ParcelWatcher.d.ts';
// NOTE: This doesn't work since it imports "@effect/platform-node-shared/NodeFileSystem/ParcelWatcher" which also seems broken
// import { layer as _ParcelWatchBackend } from '../node_modules/@effect/platform-bun/dist/esm/BunFileSystem/ParcelWatcher.js';
// NOTE: Work around for this file not being export by @effect/platform-node-shared
//       It only imports the implementation as `any`
// @ts-expect-error Types imported separately
// eslint-disable-next-line import-x/no-relative-packages
import { layer as _ParcelWatchBackend } from '../node_modules/@effect/platform-node-shared/dist/esm/NodeFileSystem/ParcelWatcher.js';
// NOTE: Stitches the implementation with the import types
const ParcelWatcher = _ParcelWatchBackend as typeof ParcelWatchBackend;

const WatchBackend = pipe(
  Effect.acquireRelease(
    pipe(
      Effect.succeed(Layer.fresh(BunFileSystem.layer).pipe(Layer.provide(Layer.fresh(ParcelWatcher)))),
      Effect.tap(() => Effect.logInfo('Fresh parcel watcher started')),
      // delay to allow backend to setup the layer before returning to caller
      Effect.tap(() => Effect.logInfo(Effect.sleep('250 millis'))),
    ),
    () => Effect.logInfo('Fresh parcel watcher stopped'),
  ),
  Layer.unwrapEffect,
);

const watch = Effect.functionWithSpan({
  body: (path: string) =>
  pipe(
    FileSystem.FileSystem,
    Effect.map((fs) => fs.watch(path)),
    Effect.map(Stream.tap(Effect.log)),
    Effect.flatMap(Stream.runScoped(Sink.drain)),
    Effect.provide(WatchBackend),
    Effect.fork,
    // delay to allow backend to setup the watch before returning to caller
    Effect.tap(() => Effect.sleep('250 millis'))
  ),
  captureStackTrace: true,
  options: { name: 'file-watcher-map-swtch'},
});
export type FileWatcherMap = HashMap.HashMap<Scope.CloseableScope, Fiber.RuntimeFiber<void, PlatformError>>;

export namespace FileWatcherMap {
  export type Ref = SynchronizedRef.SynchronizedRef<FileWatcherMap>;
  export const Ref = Context.GenericTag<Ref, Ref>('Ref');
}

/**
 * Constructs a new `FileWatcherMap`.
 */
export const ref = (): Effect.Effect<FileWatcherMap.Ref> => SynchronizedRef.make(HashMap.empty<Scope.CloseableScope, Fiber.RuntimeFiber<void, PlatformError>>());

const rootCause: <A>(cause: Cause.Cause<A>) => Cause.Cause<A> = flow(
  Match.value,
  Match.when(Cause.isDieType, (_) => (Cause.isCause(_.defect) ? rootCause(_.defect) : _)),
  Match.when(Cause.isEmptyType, (_) => _),
  Match.when(Cause.isFailType, (_) => (Cause.isCause(_.error) ? rootCause(_.error) : _)),
  Match.when(Cause.isInterruptType, (_) => _),
  Match.when(Cause.isParallelType, (_) => {
    if (Cause.isCause(_.right)) {
      return rootCause(_.right);
    }
    if (Cause.isCause(_.left)) {
      return rootCause(_.left);
    }
    return _;
  }),
  Match.when(Cause.isSequentialType, (_) => {
    if (Cause.isCause(_.right)) {
      return rootCause(_.right);
    }
    if (Cause.isCause(_.left)) {
      return rootCause(_.left);
    }
    return _;
  }),
  Match.exhaustive,
);

/**
 * Adds a `ts.FileWatcher` from the set.
 */
export const add = Effect.functionWithSpan({
  body: (ref: FileWatcherMap.Ref, path: string) => Effect.Do.pipe(
  Effect.bind('scope', () => Scope.make(ExecutionStrategy.parallel)),
  Effect.bind('fiber', ({ scope }) => pipe(watch(path), Effect.provideService(Scope.Scope, scope))),
  Effect.tap(({ scope, fiber }) =>  SynchronizedRef.getAndUpdate(ref, HashMap.set(scope, fiber))
  ),
  Effect.map(({ scope }) => scope),
),
  captureStackTrace: true,
  options: { name: 'file-watcher-map-add'},
})

/**
 * Removes a `ts.FileWatcher` from the set.
 */
export const remove = Effect.functionWithSpan({
body: (ref: FileWatcherMap.Ref, scope: Scope.CloseableScope) => Effect.Do.pipe(
  Effect.bind('map', () => SynchronizedRef.get(ref)),
  Effect.bind('fiber', ({ map }) => HashMap.get(map, scope)),
  Effect.tap(() => SynchronizedRef.getAndUpdate(ref, HashMap.remove(scope))),
  Effect.tap(({ fiber }) => Scope.close(scope, Exit.interrupt(fiber.id()))),
  Effect.flatMap(({ fiber }) => pipe(Fiber.join(fiber))),//, Effect.tapDefect(Effect.logWarning))),
  Effect.catchSomeCause(flow(
    Option.liftPredicate(Cause.isCause),
    Option.flatMap(Option.liftPredicate(Cause.isInterrupted)),
    Option.map(rootCause),
    Option.map(() => Effect.void),
  )
  ),
),
  captureStackTrace: true,
  options: { name: 'file-watcher-map-remove'},
})

// /**
//  * Provide a `FileWatcherMap.Ref` to an effect.
//  */
// export const provide: {
//   <E2 = never, R2 = never>(
//     ref: Effect.Effect<FileWatcherMap.Ref, E2, R2>,
//   ): <A, E1, R1>(effect: Effect.Effect<A, E1, R1>) => Effect.Effect<A, E1 | E2, Exclude<R1 | R2, FileWatcherMap.Ref>>;
//   <E2 extends never = never, R2 extends never = never>(
//     ref: FileWatcherMap.Ref,
//   ): <A, E1, R1>(effect: Effect.Effect<A, E1, R1>) => Effect.Effect<A, E1 | E2, Exclude<R1 | R2, FileWatcherMap.Ref>>;
// } =
//   <E2 = never, R2 = never>(ref: Effect.Effect<FileWatcherMap.Ref, E2, R2> | FileWatcherMap.Ref) =>
//   <A, E1, R1>(effect: Effect.Effect<A, E1, R1>) =>
//     Effect.gen(function* () {
//       const layer = Match.value(ref).pipe(
//         Match.when({ [SynchronizedRef.SynchronizedRefTypeId]: Predicate.isNotUndefined }, (_: FileWatcherMap.Ref) =>
//           Effect.succeed(_),
//         ),
//         Match.orElse((_) => _),
//         Layer.effect(FileWatcherMap.Ref),
//       );
//       return yield* Effect.provide(effect, layer);
//     });
