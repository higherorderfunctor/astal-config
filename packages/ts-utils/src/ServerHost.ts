import type { Layer } from 'effect';
import { Effect } from 'effect';
import ts from 'typescript';

import * as FileWatcher from './FileWatcher.js';

export class ServerHost extends Effect.Service<ServerHost>()('ServerHost', {
  dependencies: [FileWatcher.layer],
  effect: Effect.gen(function* () {
    const fileWatcher = yield* FileWatcher.FileWatcher;
    const host: ts.server.ServerHost = {
      ...ts.sys,
      clearImmediate,
      clearTimeout,
      setImmediate,
      setTimeout,
      watchDirectory: fileWatcher.stub,
      watchFile: fileWatcher.stub,
    };
    return host;
  }),
}) {}

export const layer: Layer.Layer<ServerHost> = ServerHost.Default;

export const layerNoDeps: Layer.Layer<ServerHost, never, FileWatcher.FileWatcher> =
  ServerHost.DefaultWithoutDependencies;

// watchFile(path: string, callback: FileWatcherCallback, pollingInterval?: number, options?: WatchOptions): FileWatcher;
// watchDirectory(path: string, callback: DirectoryWatcherCallback, recursive?: boolean, options?: WatchOptions): FileWatcher;
// preferNonRecursiveWatch?: boolean;
// setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): any;
// clearTimeout(timeoutId: any): void;
// setImmediate(callback: (...args: any[]) => void, ...args: any[]): any;
// clearImmediate(timeoutId: any): void;
// gc?(): void;
// trace?(s: string): void;
// require?(initialPath: string, moduleName: string): ModuleImportResult;
// args: string[];
// newLine: string;
// useCaseSensitiveFileNames: boolean;
// write(s: string): void;
// writeOutputIsTTY?(): boolean;
// getWidthOfTerminal?(): number;
// readFile(path: string, encoding?: string): string | undefined;
// getFileSize?(path: string): number;
// writeFile(path: string, data: string, writeByteOrderMark?: boolean): void;
// /**
//   * @pollingInterval - this parameter is used in polling-based watchers and ignored in watchers that
//   * use native OS file watching
//   */
// watchFile?(path: string, callback: FileWatcherCallback, pollingInterval?: number, options?: WatchOptions): FileWatcher;
// watchDirectory?(path: string, callback: DirectoryWatcherCallback, recursive?: boolean, options?: WatchOptions): FileWatcher;
// resolvePath(path: string): string;
// fileExists(path: string): boolean;
// directoryExists(path: string): boolean;
// createDirectory(path: string): void;
// getExecutingFilePath(): string;
// getCurrentDirectory(): string;
// getDirectories(path: string): string[];
// readDirectory(path: string, extensions?: readonly string[], exclude?: readonly string[], include?: readonly string[], depth?: number): string[];
// getModifiedTime?(path: string): Date | undefined;
// setModifiedTime?(path: string, time: Date): void;
// deleteFile?(path: string): void;
// /**
//   * A good implementation is node.js' `crypto.createHash`. (https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm)
//   */
// createHash?(data: string): string;
// /** This must be cryptographically secure. Only implement this method using `crypto.createHash("sha256")`. */
// createSHA256Hash?(data: string): string;
// getMemoryUsage?(): number;
// exit(exitCode?: number): void;
// realpath?(path: string): string;
// setTimeout?(callback: (...args: any[]) => void, ms: number, ...args: any[]): any;
// clearTimeout?(timeoutId: any): void;
// clearScreen?(): void;
// base64decode?(input: string): string;
// base64encode?(input: string): string;
