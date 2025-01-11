#!/usr/bin/env bun

import { Command, Options } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import { BunContext, BunRuntime, BunTerminal } from '@effect/platform-bun';
import { Doc } from '@effect/printer';
import { Array, Console, Effect, flow, pipe } from 'effect';

import { Error, PackageName } from '@astal-config/girs-fixup';

import packageJson from '../package.json' with { type: 'json' };

/**
 * Define the `--girs` path option.
 */
const ls = Effect.map(
  FileSystem.FileSystem,
  (fs) => (path: string) =>
    fs
      .readDirectory(path)
      .pipe(Effect.catchAll(({ message, method, module }) => Error.invalidValue(message, { method, module }))),
);

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
  Options.mapEffect((girs) =>
    pipe(
      ls,
      Effect.ap(Effect.succeed(girs)),
      Effect.flatten,
      Effect.flatMap(flow(Array.map(PackageName.fromDts), Effect.all)),
    ),
  ),
);

/**
 * App entry point.
 */
const command = Command.make('girs-fixup', { girs }, Console.log);

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
  BunRuntime.runMain({
    // use our own printer
    disableErrorReporting: true,
  }),
);
