import { Command, HelpDoc, Options, ValidationError } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Doc } from '@effect/printer';
import { Array, Console, Effect, flow, Inspectable, pipe } from 'effect';

import packageJson from '../package.json' with { type: 'json' };
import * as PackageName from './PackageName.js';

/**
 * Define the `--girs` path option.
 */
const ls = Effect.map(
  FileSystem.FileSystem,
  (fs) => (path: string) =>
    fs
      .readDirectory(path)
      .pipe(
        Effect.mapError((error) => ValidationError.invalidValue(HelpDoc.p(Inspectable.stringifyCircular(error, 2)))),
      ),
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
      Effect.flatMap(flow(Array.map(PackageName.make), Effect.all)),
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
export const runMain = () => {
  cli(process.argv).pipe(
    Effect.provide(BunContext.layer),
    BunRuntime.runMain({
      // use our own printer
      disableErrorReporting: true,
    }),
  );
};
