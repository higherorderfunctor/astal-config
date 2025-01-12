import type { ValidationError } from '@effect/cli';
import type { Terminal } from '@effect/platform';
import { FileSystem } from '@effect/platform';
import type { PlatformError } from '@effect/platform/Error';
import { Effect, Function, pipe } from 'effect';

import * as Error from './Error/index.js';

/**
 * Define the `--girs` path option.
 */
export const ls: {
  (
    options?: FileSystem.ReadDirectoryOptions,
  ): (
    path: string,
  ) => Effect.Effect<Array<string>, ValidationError.ValidationError, FileSystem.FileSystem | Terminal.Terminal>;
  (
    path: string,
    options?: FileSystem.ReadDirectoryOptions,
  ): Effect.Effect<Array<string>, ValidationError.ValidationError, FileSystem.FileSystem | Terminal.Terminal>;
} = Function.dual(
  (args) => typeof args[0] === 'string',
  Effect.functionWithSpan({
    body: (path: string, options?: FileSystem.ReadDirectoryOptions) =>
      Effect.Do.pipe(
        Effect.tap(() => Effect.logTrace('ls:', { options, path })),
        Effect.bind('fs', () => FileSystem.FileSystem),
        Effect.flatMap(({ fs }) =>
          fs
            .readDirectory(path, options)
            .pipe(
              Effect.catchAll(({ message, method, module }) =>
                Error.invalidValue(message, { method, module, options, path }),
              ),
            ),
        ),
        Effect.tap((results) => Effect.logInfo('ls results:', results)),
      ),
    captureStackTrace: true,
    options: { name: 'ls' },
  }),
);

export const cp: {
  (
    dest: string,
  ): (
    scaffold: string,
  ) => Effect.Effect<void, ValidationError.ValidationError, FileSystem.FileSystem | Terminal.Terminal>;
  (
    scaffold: string,
    dest: string,
  ): Effect.Effect<void, ValidationError.ValidationError, FileSystem.FileSystem | Terminal.Terminal>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (scaffold: string, dest: string) =>
      pipe(
        FileSystem.FileSystem,
        Effect.flatMap((fs) => fs.copy(scaffold, dest, { overwrite: true })),
        Effect.catchAll(({ message, method, module }) => Error.invalidValue(message, { method, module })),
      ),
    captureStackTrace: true,
    options: { name: 'cp' },
  }),
);

export const mkdir = Effect.functionWithSpan({
  body: (path: string) =>
    pipe(
      FileSystem.FileSystem,
      Effect.flatMap((fs) => fs.makeDirectory(path, { recursive: true })),
      Effect.catchAll(({ message, method, module }) => Error.invalidValue(message, { method, module })),
    ),
  captureStackTrace: true,
  options: { name: 'mkdir' },
});

export const rewrite: {
  (f: (contents: string) => string): (file: string) => Effect.Effect<void, PlatformError, FileSystem.FileSystem>;
  (file: string, f: (contents: string) => string): Effect.Effect<void, PlatformError, FileSystem.FileSystem>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (file: string, f: (contents: string) => string) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const contents = f(yield* fs.readFileString(file));
        yield* fs.writeFileString(file, f(contents));
      }),
    captureStackTrace: true,
    options: { name: 'rewrite' },
  }),
);
