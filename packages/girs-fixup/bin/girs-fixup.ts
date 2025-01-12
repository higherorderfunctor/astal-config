#!/usr/bin/env bun
import type { ValidationError } from '@effect/cli';
import { Command, Options } from '@effect/cli';
import type { Terminal } from '@effect/platform';
import { FileSystem, Path } from '@effect/platform';
import type { PlatformError } from '@effect/platform/Error';
import { BunContext, BunRuntime, BunTerminal } from '@effect/platform-bun';
import { Doc } from '@effect/printer';
import { Array, Cause, Console, Effect, flow, Function, pipe } from 'effect';
import Handlebars from 'handlebars';

import { Error, PackageName } from '@astal-config/girs-fixup';

import { ProjectService } from '@astal-config/ts-utils';

import packageJson from '../package.json' with { type: 'json' };

/**
 * Define the `--girs` path option.
 */
const ls: {
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
      Effect.flatMap(FileSystem.FileSystem, (fs) =>
        fs
          .readDirectory(path, options)
          .pipe(Effect.catchAll(({ message, method, module }) => Error.invalidValue(message, { method, module }))),
      ),
    captureStackTrace: true,
    options: { name: 'ls' },
  }),
);

const cp: {
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

const mkdir = Effect.functionWithSpan({
  body: (path: string) =>
    pipe(
      FileSystem.FileSystem,
      Effect.flatMap((fs) => fs.makeDirectory(path, { recursive: true })),
      Effect.catchAll(({ message, method, module }) => Error.invalidValue(message, { method, module })),
    ),
  captureStackTrace: true,
  options: { name: 'mkdir' },
});

const rewrite: {
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

const scaffold = Options.directory('scaffold', { exists: 'yes' }).pipe(
  Options.withDefault(`${process.cwd()}/configs/scaffolding/girs`),
  Options.withDescription(
    pipe(
      Doc.vsep([
        Doc.text('Destination location for type packages.'),
        Doc.empty,
        pipe(Doc.text('Default: `$PWD/vendor/@types`.'), Doc.indent(2)),
      ]),
      Doc.render({
        style: 'pretty',
      }),
    ),
  ),
);

const dest = Options.directory('dest', { exists: 'yes' }).pipe(
  Options.withDefault(`${process.cwd()}/vendor/@types`),
  Options.withDescription(
    pipe(
      Doc.vsep([
        Doc.text('Destination location for type packages.'),
        Doc.empty,
        pipe(Doc.text('Default: `$PWD/vendor/@types`.'), Doc.indent(2)),
      ]),
      Doc.render({
        style: 'pretty',
      }),
    ),
  ),
);

const parseDts = Effect.functionWithSpan({
  body: (girs: string) =>
    pipe(
      ls(girs),
      Effect.flatMap((files) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          return Array.map(files, (file) => path.resolve(girs, file));
        }),
      ),
      Effect.flatMap(
        flow(Array.map(PackageName.fromDts), (effect) => Effect.all(effect, { concurrency: 'unbounded' })),
      ),
    ),
  captureStackTrace: true,
  options: { name: 'options-girs' },
});

const girs = Options.directory('girs', { exists: 'yes' }).pipe(
  Options.withDefault(`${process.cwd()}/vendor/@girs`),
  Options.withDescription(
    pipe(
      Doc.vsep([
        Doc.text('Location of @girs generated types.'),
        Doc.empty,
        pipe(Doc.text('Default: `$PWD/vendor/@girs`.'), Doc.indent(2)),
      ]),
      Doc.render({
        style: 'pretty',
      }),
    ),
  ),
  Options.mapEffect(parseDts),
);

const applyTemplate = Effect.functionWithSpan({
  body: (dir: string, dts: PackageName.PackageName, scaffold: string) =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      Handlebars.registerHelper('resolve', (...args: [...Array<string>, options: Handlebars.HelperOptions]) =>
        path.resolve(...args.slice(0, -1)),
      );
      Handlebars.registerHelper('relative', (from: string, to: string) => path.relative(from, to));
      const files = Array.map(yield* ls(dir, { recursive: true }), (file) => path.resolve(dir, file));
      yield* Effect.all(
        Array.map(files, (file) =>
          rewrite(file, (contents) => {
            const template = Handlebars.compile(contents);
            return template({
              dir,
              dirname: path.normalize(path.relative(process.cwd(), scaffold)), // TODO: better handling for dirs in scaffold
              dts: path.relative(dir, dts.absolutePath.pathname),
              dtsPackageName: `@types/${dts.scope}__${dts.module}`,
              packageName: `@${dts.scope}/${dts.module}`,
            });
          }),
        ),
        { concurrency: 'unbounded' },
      );
    }),
  captureStackTrace: true,
  options: { name: 'applyTemplate' },
});

/**
 * App entry point.
 */
const command = Command.make(
  'girs-fixup',
  { dest, girs, scaffold },
  Effect.functionWithSpan({
    body: ({ dest, girs, scaffold }) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const projectService = yield* ProjectService;
        yield* Console.log(Array.map(girs, projectService.getAmbientModules()));
        yield* Console.log(girs);
        yield* mkdir(dest);
        yield* Effect.all(
          Array.map(girs, (dts) =>
            Effect.gen(function* () {
              const destination = `${dest}/${dts.scope}__${dts.module}`;
              yield* Console.log('Building scaffold');
              yield* Console.log('  Source:', scaffold);
              yield* Console.log('  Destination:', destination);
              yield* Console.log('  Scaffold:', scaffold);
              yield* Console.log('  Scaffold:', path.relative(process.cwd(), path.dirname(scaffold)));
              yield* cp(scaffold, destination);
              yield* applyTemplate(destination, dts, scaffold);
            }),
          ),
          { concurrency: 'unbounded' },
        );
        // yield* Console.log(yield* Effect.all(Array.map(files, applyTemplate), { concurrency: 'unbounded' }));
      }),
    captureStackTrace: true,
    options: { name: 'command' },
  }),
);

/**
 * Set app metadata.
 */
const cli = Command.run(command, {
  name: '@astal-config/girs-fixup',
  version: packageJson.version,
});

/**
 * Run the app.
 */
cli(process.argv).pipe(
  Effect.provide(BunContext.layer),
  Effect.provide(BunTerminal.layer),
  Effect.tapErrorCause(flow(Cause.pretty, Effect.logError)),
  Effect.tapDefect(flow(Cause.pretty, Effect.logError)),
  (v) => v,
  BunRuntime.runMain({
    // use our own printer
    disableErrorReporting: true,
  }),
);
