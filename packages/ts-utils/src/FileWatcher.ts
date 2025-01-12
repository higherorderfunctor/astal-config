import type { Layer } from 'effect';
import { Effect, flow, HashSet, pipe, Runtime, SynchronizedRef } from 'effect';
import type ts from 'typescript';

import * as FileWatcherSet from './FileWatcherSet.js';

/**
 * Stub implementation of `ts.FileWatcher`.
 */
const stub: ts.FileWatcher = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  close: () => {},
};

const removeFileWatcher = (watcher: ts.FileWatcher) =>
  Effect.flatMap(FileWatcherSet.FileWatcherSet, (watchers) => SynchronizedRef.getAndUpdate(watchers, flow(HashSet.remove(watcher))));

const watchDirectory = (
  _path: string,
  _callback: ts.DirectoryWatcherCallback,
  _recursive?: boolean,
  _options?: ts.WatchOptions,
) =>
  Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime());
    const watcher: ts.FileWatcher = {
      // TODO: implement
      close: () => pipe(removeFileWatcher(watcher), FileWatcherSet.provide(), runSync),
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
    const watchers = yield* FileWatcherSet.FileWatcherSet.Ref;
    const watcher: ts.FileWatcher = {
      // TODO: implement
      close: () => pipe(removeFileWatcher(watcher), Effect.provideService(FileWatcherSet.FileWatcherSet.Ref, watchers), runSync),
    };
    yield* SynchronizedRef.getAndUpdate(watchers, flow(HashSet.add(watcher)));
    return watcher;
  });

export class FileWatcher extends Effect.Service<FileWatcher>()('FileWatcher', {
  accessors: true,
  effect: Effect.gen(function* () {
    const runtime = yield* Effect.runtime();
    const runSync = Runtime.runSync(runtime);
    const provideWatchers = FileWatcherSet.provide(FileWatcherSet.make());

    return {
      stub: () => stub,
      unsafeWatchDirectory: flow(watchDirectory, provideWatchers, runSync),
      unsafeWatchFile: flow(watchFile, provideWatchers, runSync),
      watchDirectory: flow(watchDirectory, provideWatchers),
      watchFile: flow(watchFile, provideWatchers),
    };
  }),
}) {}

export const layer: Layer.Layer<FileWatcher> = FileWatcher.Default;
