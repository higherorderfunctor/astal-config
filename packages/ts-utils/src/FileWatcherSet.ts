import { Context, Effect, flow, HashSet, Layer, Match, Predicate, SynchronizedRef } from 'effect';
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
export const provide: {
  <E2 = never, R2 = never>(
    watchers: Effect.Effect<FileWatcherSet.Ref, E2, R2>,
  ): <A, E1, R1>(effect: Effect.Effect<A, E1, R1>) => Effect.Effect<A, E1 | E2, Exclude<R1 | R2, FileWatcherSet.Ref>>;
  <E2 extends never = never, R2 extends never = never>(
    watchers: FileWatcherSet.Ref,
  ): <A, E1, R1>(effect: Effect.Effect<A, E1, R1>) => Effect.Effect<A, E1 | E2, Exclude<R1 | R2, FileWatcherSet.Ref>>;
} =
  <E2 = never, R2 = never>(watchers: Effect.Effect<FileWatcherSet.Ref, E2, R2> | FileWatcherSet.Ref) =>
  <A, E1, R1>(effect: Effect.Effect<A, E1, R1>) =>
    Effect.gen(function* () {
      const layer = Match.value(watchers).pipe(
        Match.when({ [SynchronizedRef.SynchronizedRefTypeId]: Predicate.isNotUndefined }, (_: FileWatcherSet.Ref) =>
          Effect.succeed(_),
        ),
        Match.orElse((_) => _),
        Layer.effect(FileWatcherSet.Ref),
      );
      return yield* Effect.provide(effect, layer);
    });
