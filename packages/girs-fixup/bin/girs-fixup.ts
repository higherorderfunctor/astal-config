#!/usr/bin/env bun
import { Command, Options } from '@effect/cli';
import { Path } from '@effect/platform';
import { BunContext, BunRuntime, BunTerminal } from '@effect/platform-bun';
import { Doc } from '@effect/printer';
import { Array, Cause, Console, Effect, flow, Function, pipe } from 'effect';
import Handlebars from 'handlebars';

import { DtsFile, Shell } from '@astal-config/girs-fixup';
import { ProjectService } from '@astal-config/ts-utils';

import packageJson from '../package.json' with { type: 'json' };

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
      Effect.logTrace('parseDts:', { girs }),
      Effect.flatMap(() => Shell.ls(girs)),
      Effect.flatMap((files) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          return Array.map(files, (file) => path.resolve(girs, file));
        }),
      ),
      Effect.flatMap(flow(Array.map(DtsFile.fromDts), (effect) => Effect.all(effect, { concurrency: 'unbounded' }))),
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
  body: (dir: string, dts: DtsFile.DtsFile, scaffold: string) =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      Handlebars.registerHelper('resolve', (...args: [...Array<string>, options: Handlebars.HelperOptions]) =>
        path.resolve(...args.slice(0, -1)),
      );
      Handlebars.registerHelper('relative', (from: string, to: string) => path.relative(from, to));
      const files = Array.map(yield* Shell.ls(dir, { recursive: true }), (file) => path.resolve(dir, file));
      yield* Effect.all(
        Array.map(files, (file) =>
          Shell.rewrite(file, (contents) => {
            const template = Handlebars.compile(contents);
            return template({
              dir,
              dirname: path.normalize(path.relative(process.cwd(), scaffold)), // TODO: better handling for dirs in scaffold
              dts: path.relative(dir, dts.absolutePath.pathname),
              dtsDtsFile: `@types/${dts.scope}__${dts.module}`,
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
        const projectService = yield* ProjectService.ProjectService;
        // yield* Console.log(Array.map(girs, (file) => projectService.getAmbientModules(file.absolutePath.pathname)));
        yield* Console.log(girs);
        // yield* Shell.mkdir(dest);
        // yield* Effect.all(
        //   Array.map(girs, (dts) =>
        //     Effect.gen(function* () {
        //       const destination = `${dest}/${dts.scope}__${dts.module}`;
        //       yield* Console.log('Building scaffold');
        //       yield* Console.log('  Source:', scaffold);
        //       yield* Console.log('  Destination:', destination);
        //       yield* Console.log('  Scaffold:', scaffold);
        //       yield* Console.log('  Scaffold:', path.relative(process.cwd(), path.dirname(scaffold)));
        //       yield* Shell.cp(scaffold, destination);
        //       yield* applyTemplate(destination, dts, scaffold);
        //     }),
        //   ),
        //   { concurrency: 'unbounded' },
        // );
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
  (v) => v,
  Effect.provide(BunContext.layer),
  Effect.provide(BunTerminal.layer),
  Effect.provide(ProjectService.layer),
  (v) => v,
  Effect.tapErrorCause(flow(Cause.pretty, Effect.logError)),
  Effect.tapDefect(flow(Cause.pretty, Effect.logError)),
  (v) => v,
  BunRuntime.runMain({
    // use our own printer
    disableErrorReporting: true,
  }),
);
