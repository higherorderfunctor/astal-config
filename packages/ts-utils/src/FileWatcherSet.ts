import { Context, Effect, flow, HashSet, SynchronizedRef } from 'effect';
import type ts from 'typescript';

export type FileWatcherSet = HashSet.HashSet<ts.FileWatcher>;

// export type FileWatcherSetRef = SynchronizedRef.SynchronizedRef<FileWatcherSet>;
export namespace FileWatcherSet {
  export type Ref = SynchronizedRef.SynchronizedRef<FileWatcherSet>;
  export const Ref = Context.GenericTag<Ref, Ref>('Ref');
}

const op: (
  f: (watcher: ts.FileWatcher) => (set: FileWatcherSet) => FileWatcherSet,
) => (watcher: ts.FileWatcher) => Effect.Effect<FileWatcherSet, never, FileWatcherSet.Ref> = (f) => (watcher) =>
  Effect.flatMap(FileWatcherSet.Ref, (watchers) => SynchronizedRef.getAndUpdate(watchers, flow(f(watcher))));

/**
 * Constructs a new `FileWatcherSet`.
 */
export const make = (): Effect.Effect<FileWatcherSet.Ref> => SynchronizedRef.make(HashSet.empty<ts.FileWatcher>());

/**
 * Adds a `ts.FileWatcher` from the set.
 */
export const add = op(HashSet.add);

/**
 * Removes a `ts.FileWatcher` from the set.
 */
export const remove = op(HashSet.remove);

/**
 * Provide a `FileWatcherSet.Ref` to an effect.
 */
// TODO: dual
export const provide:
  {
    <E2 = never, R2 = never>(watchers: Effect.Effect<FileWatcherSet.Ref, E2, R2>): <A, E1, R1>(effect: Effect.Effect<A, E1, R1>) => Effect.Effect<A, E1 | E2, Exclude<R1 | R2, FileWatcherSet.Ref>;
    (): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R | FileWatcherSet.Ref>;
} = 
<E2 = never, R2 = never>(watchers?: Effect.Effect<FileWatcherSet.Ref, E2, R2>) =>
  <A, E1, R1>(effect: Effect.Effect<A, E1, R1>) => Effect.gen(function* () {
    const e = watchers ? yield* watchers : yield* FileWatcherSet.Ref;
    return Effect.provideService(effect, FileWatcherSet.Ref, e);
  }) as any;
