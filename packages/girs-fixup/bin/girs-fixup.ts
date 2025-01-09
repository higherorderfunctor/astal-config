#!/usr/bin/env bun

import { Command, HelpDoc, Options as CliOptions } from '@effect/cli';
import { Command as PlatformCommand, FileSystem, Path } from '@effect/platform';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Console, Effect } from 'effect';

import packageJson from '../package.json' with { type: 'json' };

export namespace PackageName {
  const make = (filename: string) => {
    const { astal, ext, packageName } = {
      .../^(?<astal>astal)(<packageName>.+)(?<ext>\.d\.ts)/.exec(filename)?.groups,
    } as {
      astal?: 'astal';
      ext?: string;
      packageName?: string;
    };
    if (match?.groups) {
    }
  };
}

/**
 * Define the `--girs` path option.
 */
const girs = CliOptions.directory('girs', { exists: 'yes' }).pipe(
  CliOptions.mapEffect((tsconfig) => Path.Path.pipe(Effect.map((path) => path.resolve(tsconfig)))),
  CliOptions.withDefault(`${process.cwd()}/vendor/@girs`),
  // TODO: helpdoc
  CliOptions.withDescription('Location of @girs generated typed.  Default: `${process.cwd()}/vendor/@girs`.'),
);

/**
 * App entry point.
 */
const command = Command.make('girs-fixup', { girs }, ({ girs }) =>
  Effect.Do.pipe(
    Effect.bind('fs', () => FileSystem.FileSystem),
    Effect.flatMap(({ fs }) => fs.readDirectory(girs)),
    Effect.flatMap(Console.log),
  ),
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
  BunRuntime.runMain({
    // use our own printer
    // disableErrorReporting: true,
  }),
);
