import type { Layer } from 'effect';
import { Context, Effect, flow, HashSet, pipe, Runtime, SynchronizedRef } from 'effect';
import type ts from 'typescript';

export const Watchers = Context.GenericTag<
  SynchronizedRef.SynchronizedRef<HashSet.HashSet<ts.FileWatcher>>,
  SynchronizedRef.SynchronizedRef<HashSet.HashSet<ts.FileWatcher>>
>('Watchers');

const stub: ts.FileWatcher = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  close: () => {},
};

const close = (watcher: ts.FileWatcher) =>
  Effect.flatMap(Watchers, (watchers) => SynchronizedRef.getAndUpdate(watchers, flow(HashSet.remove(watcher))));

const watchDirectory = (
  _path: string,
  _callback: ts.DirectoryWatcherCallback,
  _recursive?: boolean,
  _options?: ts.WatchOptions,
) =>
  Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime());
    const watchers = yield* Watchers;
    const watcher: ts.FileWatcher = {
      // TODO: implement
      close: () => pipe(close(watcher), Effect.provideService(Watchers, watchers), runSync),
    };
    yield* SynchronizedRef.getAndUpdate(watchers, flow(HashSet.add(watcher)));
    return watcher;
  });

const watchFile = (
  _path: string,
  _callback: ts.FileWatcherCallback,
  _pollingInterval?: number,
  _options?: ts.WatchOptions,
) =>
  Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime());
    const watchers = yield* Watchers;
    const watcher: ts.FileWatcher = {
      // TODO: implement
      close: () => pipe(close(watcher), Effect.provideService(Watchers, watchers), runSync),
    };
    yield* SynchronizedRef.getAndUpdate(watchers, flow(HashSet.add(watcher)));
    return watcher;
  });

export class FileWatcher extends Effect.Service<FileWatcher>()('FileWatcher', {
  accessors: true,
  effect: Effect.gen(function* () {
    const runtime = yield* Effect.runtime();
    const runSync = Runtime.runSync(runtime);
    const provideWatchers = Effect.provideService(
      Watchers,
      yield* SynchronizedRef.make(HashSet.empty<ts.FileWatcher>()),
    );

    return {
      close: flow(close, provideWatchers),
      stub: () => stub,
      unsafeClose: flow(close, provideWatchers, runSync),
      unsafeWatchDirectory: flow(watchDirectory, provideWatchers, runSync),
      unsafeWatchFile: flow(watchFile, provideWatchers, runSync),
      watchDirectory: flow(watchDirectory, provideWatchers),
      watchFile: flow(watchFile, provideWatchers),
    };
  }),
}) {}

export const layer: Layer.Layer<FileWatcher> = FileWatcher.Default;
