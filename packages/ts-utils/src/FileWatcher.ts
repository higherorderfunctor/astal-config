import type { Layer } from 'effect';
import { Effect, ExecutionStrategy, flow, HashSet, pipe, Runtime, Scope, Stream } from 'effect';
import type ts from 'typescript';

import * as FileWatcherSet from './FileWatcherSet.js';
import { FileSystem } from '@effect/platform';
import { PlatformError } from '@effect/platform/Error';

/**
 * Stub implementation of `ts.FileWatcher`.
 */
const stub: ts.FileWatcher = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  close: () => {},
};

const watchDirectory = (stream: Stream.Stream<FileSystem.WatchEvent, PlatformError, never>) => (
  path: string,
  _callback: ts.DirectoryWatcherCallback,
  _recursive?: boolean,
  _options?: ts.WatchOptions,
) =>
  Effect.Do.pipe(
    Effect.bind('runSync', () => pipe(Effect.runtime(), Effect.map(Runtime.runSync))),
    Effect.bind('ref', () => FileWatcherSet.FileWatcherSet.Ref),
    Effect.bind('watcher', ({ ref, runSync }) => Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const scope = Scope.make(ExecutionStrategy.parallel)
      const watcher = Effect.scopefs.watch(path)
      const ret: ts.FileWatcher = {
      // TODO: implement
      close: () => {
        pipe(FileWatcherSet.remove(watcher), FileWatcherSet.provide(ref), runSync);
      },
    };
    return Effect.succeed(ret);
    }),
    Effect.tap(({ watchers, watcher }) => SynchronizedRef.getAndUpdate(watchers, flow(HashSet.add(watcher))))
  );

const watchFile = (
  _path: string,
  _callback: ts.FileWatcherCallback,
  // (fileName: string, eventKind: FileWatcherEventKind, modifiedTime?: Date) => void;
  _pollingInterval?: number,
  _options?: ts.WatchOptions,
        // watchFile?: WatchFileKind;
        // watchDirectory?: WatchDirectoryKind;
        // fallbackPolling?: PollingWatchKind;
        // synchronousWatchDirectory?: boolean;
        // excludeDirectories?: string[];
        // excludeFiles?: string[];
        // [option: string]: CompilerOptionsValue | undefined;
) =>
  Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime());
    const watchers = yield* FileWatcherSet.FileWatcherSet.Ref;
    const watcher: ts.FileWatcher = {
      // TODO: implement
      close: () => {
        pipe(FileWatcherSet.remove(watcher), FileWatcherSet.provide(watchers), runSync);
      },
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
