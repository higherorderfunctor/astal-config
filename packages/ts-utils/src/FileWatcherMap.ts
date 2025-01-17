import { FileSystem, Path } from '@effect/platform';
import type { PlatformError } from '@effect/platform/Error';
import { BunFileSystem } from '@effect/platform-bun';
import * as ParcelWatcher from '@effect/platform-bun/BunFileSystem/ParcelWatcher';
import {
  Cause,
  Effect,
  ExecutionStrategy,
  Exit,
  Fiber,
  flow,
  Function,
  HashMap,
  Layer,
  Match,
  Option,
  pipe,
  Scope,
  Stream,
  SynchronizedRef,
} from 'effect';

export type Callback<E, R> = (event: FileSystem.WatchEvent) => Effect.Effect<void, E | PlatformError, R>;

export type FileWatcherMap<E> = SynchronizedRef.SynchronizedRef<
  HashMap.HashMap<Scope.CloseableScope, Fiber.RuntimeFiber<void, E | PlatformError>>
>;

/**
 * Create a fresh `FileSystem` instance to support watch unsubscribing.
 */
const FileSystemWithWatchBackend = (filepath: string) =>
  pipe(
    Path.Path,
    Effect.flatMap(
      Effect.functionWithSpan({
        body: () =>
          pipe(
            Effect.acquireRelease(
              pipe(
                // start with a fresh file system layer
                Effect.succeed(Layer.fresh(BunFileSystem.layer)),
                Effect.provide(Layer.fresh(ParcelWatcher.layer)),
                // log the resource is acquired
                Effect.tap(() => Effect.logInfo('Started watching:', filepath)),
                // delay to allow backend to setup the layer before returning to caller
                Effect.tap(() => Effect.logInfo(Effect.sleep('250 millis'))),
              ),
              // log the resource is released
              () => Effect.logInfo('Stopped watching:', filepath),
            ),
          ),
        captureStackTrace: true,
        options: (path: Path.Path) => ({ name: `fs-watch-${path.relative(process.cwd(), filepath)}` }),
      }),
    ),
    Layer.unwrapEffect,
  );
/**
 *
 * Setup a scoped watch in a forked fiber consuming the stream.
 */
const watch = Effect.functionWithSpan({
  body: <E, R>(path: string, callback: Callback<E, R>) =>
    pipe(
      // require file system
      FileSystem.FileSystem,
      // start the watch
      Effect.map((fs) => fs.watch(path)),
      // watch handler
      Effect.flatMap(Stream.runForEachScoped(callback)),
      // inject a fresh version
      Effect.provide(FileSystemWithWatchBackend(path)),
      // run the stream processor in parallel to the parent fiber
      Effect.fork,
      // delay to allow backend to setup the watch before returning to caller
      Effect.tap(() => Effect.sleep('250 millis')),
    ),
  captureStackTrace: true,
  options: { name: 'file-watcher-map-watch' },
});

/**
 * Constructs a new `FileWatcherMap`.
 */
export const make = <E = never>(): Effect.Effect<FileWatcherMap<E>> =>
  SynchronizedRef.make(HashMap.empty<Scope.CloseableScope, Fiber.RuntimeFiber<void, E | PlatformError>>());

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
export const add: {
  <E, R>(path: string, callback: Callback<E, R>): (watchers: FileWatcherMap<E>) => Effect.Effect<Scope.CloseableScope>;
  <E, R>(watchers: FileWatcherMap<E>, path: string, callback: Callback<E, R>): Effect.Effect<Scope.CloseableScope>;
} = Function.dual(
  3,
  Effect.functionWithSpan({
    body: <E, R>(watchers: FileWatcherMap<E>, path: string, callback: Callback<E, R>) =>
      Effect.Do.pipe(
        Effect.bind('scope', () => Scope.make(ExecutionStrategy.parallel)),
        Effect.bind('fiber', ({ scope }) => pipe(watch(path, callback), Effect.provideService(Scope.Scope, scope))),
        Effect.tap(({ fiber, scope }) => SynchronizedRef.getAndUpdate(watchers, HashMap.set(scope, fiber))),
        Effect.map(({ scope }) => scope),
      ),
    captureStackTrace: true,
    options: { name: 'file-watcher-map-add' },
  }),
);

/**
 * Removes a `ts.FileWatcher` from the set.
 */
export const remove: {
  (
    scope: Scope.CloseableScope,
  ): <E>(watchers: FileWatcherMap<E>) => Effect.Effect<void, Cause.NoSuchElementException | PlatformError>;
  <E>(
    watchers: FileWatcherMap<E>,
    scope: Scope.CloseableScope,
  ): Effect.Effect<void, Cause.NoSuchElementException | PlatformError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: <E>(watchers: FileWatcherMap<E>, scope: Scope.CloseableScope) =>
      Effect.Do.pipe(
        Effect.bind('map', () => SynchronizedRef.get(watchers)),
        Effect.bind('fiber', ({ map }) => HashMap.get(map, scope)),
        Effect.tap(() => SynchronizedRef.getAndUpdate(watchers, HashMap.remove(scope))),
        Effect.tap(({ fiber }) => Scope.close(scope, Exit.interrupt(fiber.id()))),
        Effect.flatMap(({ fiber }) => pipe(Fiber.join(fiber))),
        Effect.catchSomeCause(
          flow(
            Option.liftPredicate(Cause.isCause),
            Option.flatMap(Option.liftPredicate(Cause.isInterrupted)),
            Option.map(rootCause),
            Option.map(() => Effect.void),
          ),
        ),
      ),
    captureStackTrace: true,
    options: { name: 'file-watcher-map-remove' },
  }),
);
