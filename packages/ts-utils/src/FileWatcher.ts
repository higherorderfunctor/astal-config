import type { Layer } from 'effect';
import { DateTime, Effect, flow, Match, Runtime } from 'effect';
import ts from 'typescript';

import * as FileWatcherMap from './FileWatcherMap.js';

/**
 * Stub implementation of `ts.FileWatcher`.
 */
const stub: ts.FileWatcher = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  close: () => {},
};

const watchDirectory =
  <E = never>(watchers: FileWatcherMap.FileWatcherMap<E>) =>
  (path: string, callback: ts.DirectoryWatcherCallback, _recursive?: boolean, _options?: ts.WatchOptions) =>
    // type DirectoryWatcherCallback = (fileName: string) => void;
    Effect.gen(function* () {
      const runSync = Runtime.runSync(yield* Effect.runtime());
      const watcher = yield* FileWatcherMap.add(watchers, path, (event) =>
        Effect.sync(() => {
          callback(event.path);
        }),
      );
      return {
        // TODO: implement
        close: () => {
          runSync(FileWatcherMap.remove(watchers, watcher));
        },
      } satisfies ts.FileWatcher;
    });

const watchFile =
  <E = never>(watchers: FileWatcherMap.FileWatcherMap<E>) =>
  (
    path: string,
    callback: ts.FileWatcherCallback,
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
      const watcher = yield* FileWatcherMap.add(watchers, path, (event) =>
        DateTime.now.pipe(
          Effect.flatMap((now) =>
            Effect.sync(() => {
              callback(
                event.path,
                Match.value(event).pipe(
                  Match.tag('Create', () => ts.FileWatcherEventKind.Created),
                  Match.tag('Update', () => ts.FileWatcherEventKind.Changed),
                  Match.tag('Remove', () => ts.FileWatcherEventKind.Deleted),
                  Match.exhaustive,
                ),
                DateTime.toDateUtc(now),
              );
            }),
          ),
        ),
      );
      return {
        // TODO: implement
        close: () => {
          runSync(FileWatcherMap.remove(watchers, watcher));
        },
      } satisfies ts.FileWatcher;
    });

export class FileWatcher extends Effect.Service<FileWatcher>()('FileWatcher', {
  accessors: true,
  effect: Effect.gen(function* () {
    const runtime = yield* Effect.runtime();
    const runSync = Runtime.runSync(runtime);
    const watchers = yield* FileWatcherMap.make();

    return {
      stub: () => stub,
      unsafeWatchDirectory: flow(watchDirectory(watchers), runSync),
      unsafeWatchFile: flow(watchFile(watchers), runSync),
      watchDirectory: flow(watchDirectory(watchers)),
      watchFile: flow(watchFile(watchers)),
    };
  }),
}) {}

export const layer: Layer.Layer<FileWatcher> = FileWatcher.Default;
