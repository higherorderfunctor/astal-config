import { Cause, Context, Fiber, HashMap, Layer, Match, Sink, SynchronizedRef } from 'effect';
import { Effect, ExecutionStrategy, flow, HashSet, pipe, Runtime, Scope, Stream } from 'effect';
import type ts from 'typescript';

import * as FileWatcherSet from './FileWatcherMap.js';
import { FileSystem } from '@effect/platform';
import { PlatformError } from '@effect/platform/Error';

// // NOTE: Work around for this file not being exported by @effect/platform-bun
// //       It only imports the types.
// // eslint-disable-next-line import-x/no-relative-packages
// import type { layer as ParcelWatchBackend } from '../node_modules/@effect/platform-bun/dist/dts/BunFileSystem/ParcelWatcher.d.ts';
// // NOTE: This doesn't work since it imports "@effect/platform-node-shared/NodeFileSystem/ParcelWatcher" which also seems broken
// // import { layer as _ParcelWatchBackend } from '../node_modules/@effect/platform-bun/dist/esm/BunFileSystem/ParcelWatcher.js';
// // NOTE: Work around for this file not being export by @effect/platform-node-shared
// //       It only imports the implementation as `any`
// // @ts-expect-error Types imported separately
// // eslint-disable-next-line import-x/no-relative-packages
// import { layer as _ParcelWatchBackend } from '../node_modules/@effect/platform-node-shared/dist/esm/NodeFileSystem/ParcelWatcher.js';
// import { BunFileSystem } from '@effect/platform-bun';
// import { RuntimeFiber } from 'effect/Fiber';
//
// // NOTE: Stitches the implementation with the import types
// const ParcelWatcher = _ParcelWatchBackend as typeof ParcelWatchBackend;
//
// const WatchBackend = pipe(
//   Effect.acquireRelease(
//     pipe(
//       Effect.succeed(Layer.fresh(BunFileSystem.layer).pipe(Layer.provide(Layer.fresh(ParcelWatcher)))),
//       Effect.tap(() => Effect.logInfo('Fresh parcel watcher started')),
//     ),
//     () => Effect.logInfo('Fresh parcel watcher stopped'),
//   ),
//   Layer.unwrapEffect,
// );
//
// const watch = (path: string) =>
//   pipe(
//     FileSystem.FileSystem,
//     Effect.map((fs) => fs.watch(path)),
//     Effect.map(Stream.tap(Effect.log)),
//     Effect.flatMap(Stream.runScoped(Sink.drain)),
//     Effect.provide(WatchBackend),
//     Effect.fork,
//     v=>v
//   );
//
// const rootCause: <A>(cause: Cause.Cause<A>) => Cause.Cause<A> = flow(
//   Match.value,
//   Match.when(Cause.isDieType, (_) => (Cause.isCause(_.defect) ? rootCause(_.defect) : _)),
//   Match.when(Cause.isEmptyType, (_) => _),
//   Match.when(Cause.isFailType, (_) => (Cause.isCause(_.error) ? rootCause(_.error) : _)),
//   Match.when(Cause.isInterruptType, (_) => _),
//   Match.when(Cause.isParallelType, (_) => {
//     if (Cause.isCause(_.right)) {
//       return rootCause(_.right);
//     }
//     if (Cause.isCause(_.left)) {
//       return rootCause(_.left);
//     }
//     return _;
//   }),
//   Match.when(Cause.isSequentialType, (_) => {
//     if (Cause.isCause(_.right)) {
//       return rootCause(_.right);
//     }
//     if (Cause.isCause(_.left)) {
//       return rootCause(_.left);
//     }
//     return _;
//   }),
//   Match.exhaustive,
// );
//
// /**
//  * Stub implementation of `ts.FileWatcher`.
//  */
// const stub: ts.FileWatcher = {
//   // eslint-disable-next-line @typescript-eslint/no-empty-function
//   close: () => {},
// };
//
// export type FileWatcherMap = HashMap.HashMap<Scope.CloseableScope, Fiber.RuntimeFiber<void, PlatformError>>;
//
// export namespace FileWatcherSet {
//   export type Ref = SynchronizedRef.SynchronizedRef<FileWatcherSet>;
//   export const Ref = Context.GenericTag<Ref, Ref>('Ref');
// }
//
// const watchDirectory = (stream: Stream.Stream<FileSystem.WatchEvent, PlatformError, never>) => (
//   path: string,
//   _callback: ts.DirectoryWatcherCallback,
//   _recursive?: boolean,
//   _options?: ts.WatchOptions,
// ) =>
//   Effect.Do.pipe(
//     Effect.bind('runSync', () => pipe(Effect.runtime(), Effect.map(Runtime.runSync))),
//     Effect.bind('ref', () => FileWatcherSet.FileWatcherSet.Ref),
//     Effect.bind('watcher', ({ ref, runSync }) => Effect.gen(function* () {
//       const fs = yield* FileSystem.FileSystem;
//       const scope = Scope.make(ExecutionStrategy.parallel)
//       const watcher = Effect.scopefs.watch(path)
//       const ret: ts.FileWatcher = {
//       // TODO: implement
//       close: () => {
//         pipe(FileWatcherSet.remove(watcher), FileWatcherSet.provide(ref), runSync);
//       },
//     };
//     return Effect.succeed(ret);
//     }),
//     Effect.tap(({ watchers, watcher }) => SynchronizedRef.getAndUpdate(watchers, flow(HashSet.add(watcher))))
//   );
//
// const watchFile = (
//   _path: string,
//   _callback: ts.FileWatcherCallback,
//   // (fileName: string, eventKind: FileWatcherEventKind, modifiedTime?: Date) => void;
//   _pollingInterval?: number,
//   _options?: ts.WatchOptions,
//         // watchFile?: WatchFileKind;
//         // watchDirectory?: WatchDirectoryKind;
//         // fallbackPolling?: PollingWatchKind;
//         // synchronousWatchDirectory?: boolean;
//         // excludeDirectories?: string[];
//         // excludeFiles?: string[];
//         // [option: string]: CompilerOptionsValue | undefined;
// ) =>
//   Effect.gen(function* () {
//     const runSync = Runtime.runSync(yield* Effect.runtime());
//     const watchers = yield* FileWatcherSet.FileWatcherSet.Ref;
//     const watcher: ts.FileWatcher = {
//       // TODO: implement
//       close: () => {
//         pipe(FileWatcherSet.remove(watcher), FileWatcherSet.provide(watchers), runSync);
//       },
//     };
//     yield* SynchronizedRef.getAndUpdate(watchers, flow(HashSet.add(watcher)));
//     return watcher;
//   });
//
// export class FileWatcher extends Effect.Service<FileWatcher>()('FileWatcher', {
//   accessors: true,
//   effect: Effect.gen(function* () {
//     const runtime = yield* Effect.runtime();
//     const runSync = Runtime.runSync(runtime);
//     const provideWatchers = FileWatcherSet.provide(FileWatcherSet.make());
//
//     return {
//       stub: () => stub,
//       unsafeWatchDirectory: flow(watchDirectory, provideWatchers, runSync),
//       unsafeWatchFile: flow(watchFile, provideWatchers, runSync),
//       watchDirectory: flow(watchDirectory, provideWatchers),
//       watchFile: flow(watchFile, provideWatchers),
//     };
//   }),
// }) {}
//
// export const layer: Layer.Layer<FileWatcher> = FileWatcher.Default;
