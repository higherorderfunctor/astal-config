import { Context, Effect, flow, HashSet, SynchronizedRef } from 'effect';
import type ts from 'typescript';

export type FileWatcherSet = HashSet.HashSet<ts.FileWatcher>;

export const FileWatcherSet = Context.GenericTag<
  SynchronizedRef.SynchronizedRef<FileWatcherSet>,
  SynchronizedRef.SynchronizedRef<FileWatcherSet>
>('FileWatcherSet');

const op: (f: (watcher: ts.FileWatcher) => (set: FileWatcherSet) => FileWatcherSet) =>
(watcher: ts.FileWatcher) => Effect.Effect<FileWatcherSet, never, FileWatcherSet> = (f) =>
  (watcher) => Effect.flatMap(FileWatcherSet, (watchers) => SynchronizedRef.getAndUpdate(watchers, flow(f(watcher))))

/**
 * Constructs a new `FileWatcherSet`.
 */
export const make = (): Effect.Effect<FileWatcherSet> => SynchronizedRef.make(HashSet.empty<ts.FileWatcher>())

/**
 * Adds a `ts.FileWatcher` from the set.
 */
export const add = op(HashSet.add)
  //Effect.flatMap(FileWatcherSet, (watchers) => SynchronizedRef.getAndUpdate(watchers, flow(HashSet.add(watcher))));

/**
 * Removes a `ts.FileWatcher` from the set.
 */
export const remove = (watcher: ts.FileWatcher) =>
  Effect.flatMap(FileWatcherSet, (watchers) => SynchronizedRef.getAndUpdate(watchers, flow(HashSet.remove(watcher))));
